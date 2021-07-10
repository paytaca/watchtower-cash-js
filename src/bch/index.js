const axios = require('axios')
const BCHJS = require("@psf/bch-js")
const bchjs = new BCHJS()
const BigNumber = require('bignumber.js')

class BCH {

  constructor (apiBaseUrl) {
    this._api = axios.create({
      baseURL: apiBaseUrl
    })
    this.dustLimit = 546
  }

  async getBchUtxos (handle, value) {
    let resp
    if (handle.indexOf('wallet:') > -1) {
      resp = await this._api.get(`utxo/wallet/${handle.split('wallet:')[1]}/`)
    } else {
      resp = await this._api.get(`utxo/bch/${handle}/`)
    }
    let cumulativeValue = new BigNumber(0)
    let filteredUtxos = []
    const utxos = resp.data.utxos
    for (let i = 0; i < utxos.length; i++) {
      cumulativeValue = cumulativeValue.plus(utxos[i].value)
      filteredUtxos.push(utxos[i])
      if (cumulativeValue.isGreaterThanOrEqualTo(value)) {
        break
      }
    }
    return {
      cumulativeValue: cumulativeValue,
      utxos: filteredUtxos.map(function (item) {
        return {
          tx_hash: item.txid,
          tx_pos: item.vout,
          value: new BigNumber(item.value),
          wallet_index: item.wallet_index
        }
      })
    }
  }

  async broadcastTransaction(txHex) {
    const resp = await this._api.post('broadcast/', { transaction: txHex })
    return resp
  }

  async retrievePrivateKey(mnemonic, derivationPath, walletIndex) {
    const seedBuffer = await bchjs.Mnemonic.toSeed(mnemonic)
    const masterHDNode = bchjs.HDNode.fromSeed(seedBuffer)
    const childNode = masterHDNode.derivePath(derivationPath + '/' + walletIndex)
    return bchjs.HDNode.toWIF(childNode)
  }

  async send({ sender, recipients, feeFunder, changeAddress, broadcast }) {
    let walletHash
    if (sender.walletHash !== undefined) {
      walletHash = sender.walletHash
    }

    if (broadcast == undefined) {
      broadcast = true
    }

    let totalSendAmount = 0
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      if (recipient.address.indexOf('bitcoincash') < 0) {
        return {
          success: false,
          error: 'recipient should have a BCH address'
        }
      }
      totalSendAmount += recipient.amount
    }

    const totalSendAmountSats = parseInt(totalSendAmount * (10 ** 8))
    let handle
    if (walletHash) {
      handle = 'wallet:' + walletHash
    } else {
      handle = sender.address
    }
    const bchUtxos = await this.getBchUtxos(handle, totalSendAmountSats)
    if (bchUtxos.cumulativeValue < totalSendAmountSats) {
      return {
        success: false,
        error: `not enough balance in sender address (${bchUtxos.cumulativeValue}) to cover the send amount (${totalSendAmountSats})`
      }
    }
    
    const keyPairs = []

    let transactionBuilder = new bchjs.TransactionBuilder()
    let outputsCount = 0
    let totalInput = new BigNumber(0)
    let totalOutput = new BigNumber(0)
    
    for (let i = 0; i < bchUtxos.utxos.length; i++) {
      transactionBuilder.addInput(bchUtxos.utxos[i].tx_hash, bchUtxos.utxos[i].tx_pos)
      totalInput = totalInput.plus(bchUtxos.utxos[i].value)
      if (walletHash) {
        const utxoPkWif = await this.retrievePrivateKey(
          sender.mnemonic,
          sender.derivationPath,
          bchUtxos.utxos[i].wallet_index
        )
        const utxoKeyPair = bchjs.ECPair.fromWIF(utxoPkWif)
        keyPairs.push(utxoKeyPair)
        if (!changeAddress) {
          changeAddress = bchjs.ECPair.toCashAddress(utxoKeyPair)
        }
      } else {
        const senderKeyPair = bchjs.ECPair.fromWIF(sender.wif)
        keyPairs.push(senderKeyPair)
        if (!changeAddress) {
          changeAddress = bchjs.ECPair.toCashAddress(senderKeyPair)
        }
      }
    }

    let inputsCount = bchUtxos.utxos.length

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      const sendAmount = new BigNumber(recipient.amount).times(10 ** 8)
      transactionBuilder.addOutput(
        bchjs.Address.toLegacyAddress(recipient.address),
        parseInt(sendAmount)
      )
      outputsCount += 1
      totalOutput = totalOutput.plus(sendAmount)
    }

    if (feeFunder !== undefined) {
      inputsCount += 1  // Add extra for the fee funder input
    }
    outputsCount += 1  // Add extra for sending the BCH change,if any
    let byteCount = bchjs.BitcoinCash.getByteCount(
      {
        P2PKH: inputsCount
      },
      {
        P2PKH: outputsCount
      }
    )

    let feeRate = 1.05 // 1.05 sats/byte fee rate
    if (feeFunder !== undefined) {
      feeRate = 1.15
    }

    const txFee = Math.ceil(byteCount * feeRate)
    let senderRemainder = 0

    let feeFunderUtxos
    if (feeFunder !== undefined) {
      feeFunderUtxos = await this.getBchUtxos(feeFunder.address, txFee)
      if (feeFunderUtxos.cumulativeValue < txFee) {
        return {
          success: false,
          error: `not enough balance in fee funder address (${feeFunderUtxos.cumulativeValue}) to cover the fee (${txFee})`
        }
      }
      if (feeFunderUtxos.utxos.length > 2) {
        return {
          success: false,
          error: 'UTXOs of your fee funder address are thinly spread out which can cause inaccurate fee computation'
        }
      }

      // Send BCH change back to sender address, if any
      senderRemainder = totalInput.minus(totalOutput)
      if (senderRemainder.isGreaterThanOrEqualTo(this.dustLimit)) {
        transactionBuilder.addOutput(
          bchjs.Address.toLegacyAddress(mainChangeAddress),
          parseInt(senderRemainder)
        )
      }
      
      let feeInputContrib = new BigNumber(0)
      for (let i = 0; i < feeFunderUtxos.utxos.length; i++) {
        transactionBuilder.addInput(feeFunderUtxos.utxos[i].tx_hash, feeFunderUtxos.utxos[i].tx_pos)
        totalInput = totalInput.plus(feeFunderUtxos.utxos[i].value)
        feeInputContrib = feeInputContrib.plus(feeFunderUtxos.utxos[i].value)
        const feeFunderKeyPair = bchjs.ECPair.fromWIF(feeFunder.wif)
        keyPairs.push(feeFunderKeyPair)
      }

      const feeFunderRemainder = feeInputContrib.minus(txFee)
      if (feeFunderRemainder.isGreaterThan(0)) {
        transactionBuilder.addOutput(
          bchjs.Address.toLegacyAddress(feeFunder.address),
          parseInt(feeFunderRemainder)
        )
      }
    } else {
      // Send the BCH change back to the wallet, if any
      senderRemainder = totalInput.minus(totalOutput.plus(txFee))
      if (senderRemainder.isGreaterThan(0)) {
        transactionBuilder.addOutput(
          bchjs.Address.toLegacyAddress(mainChangeAddress),
          parseInt(senderRemainder)
        )
      }
    }

    let combinedUtxos = bchUtxos.utxos
    if (feeFunder !== undefined) {
      combinedUtxos = bchUtxos.utxos.concat(feeFunderUtxos.utxos)
    }

    // Sign each token UTXO being consumed.
    let redeemScript
    for (let i = 0; i < keyPairs.length; i++) {
      const utxo = combinedUtxos[i]
      transactionBuilder.sign(
        i,
        keyPairs[i],
        redeemScript,
        transactionBuilder.hashTypes.SIGHASH_ALL,
        parseInt(utxo.value)
      )
    }

    const tx = transactionBuilder.build()
    const hex = tx.toHex()

    if (broadcast === true) {
      try {
        const response = await this.broadcastTransaction(hex)
        return response.data
      } catch (error) {
        return error.response.data
      }
    } else {
      return {
        success: true,
        transaction: hex
      }
    }

  }
}

module.exports = BCH
