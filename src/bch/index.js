const axios = require('axios')
const BCHJS = require("@psf/bch-js")
const bchjs = new BCHJS()

class BCH {

  constructor (apiBaseUrl) {
    this._api = axios.create({
      baseURL: apiBaseUrl
    })
  }

  async getBchUtxos (address, value) {
    const resp = await this._api.get(`utxo/bch/${address}`)
    let cumulativeValue = 0
    let filteredUtxos = []
    const utxos = resp.data.utxos
    for (let i = 0; i < utxos.length; i++) {
      cumulativeValue += Math.floor(utxos[i].value)
      filteredUtxos.push(utxos[i])
      if (cumulativeValue >= value) {
        break
      }
    }
    return {
      cumulativeValue: cumulativeValue,
      utxos: filteredUtxos.map(function (item) {
        return {
          tx_hash: item.txid,
          tx_pos: item.vout,
          value: Math.floor(item.value)
        }
      })
    }
  }

  async broadcastTransaction(txHex) {
    const resp = await this._api.post('broadcast/', { transaction: txHex })
    return resp
  }

  async send({ sender, recipients, feeFunder, broadcast }) {
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

    const totalSendAmountSats = totalSendAmount * (10 ** 8)
    const bchUtxos = await this.getBchUtxos(sender.address, totalSendAmountSats)
    if (bchUtxos.cumulativeValue < totalSendAmountSats) {
      return {
        success: false,
        error: `not enough balance in sender address (${bchUtxos.cumulativeValue}) to cover the send amount (${totalSendAmountSats})`
      }
    }
    
    const keyPairs = []

    let transactionBuilder = new bchjs.TransactionBuilder()
    let outputsCount = 0
    let totalInput = 0
    let totalOutput = 0
    
    for (let i = 0; i < bchUtxos.utxos.length; i++) {
      transactionBuilder.addInput(bchUtxos.utxos[i].tx_hash, bchUtxos.utxos[i].tx_pos)
      totalInput += bchUtxos.utxos[i].value
      const senderKeyPair = bchjs.ECPair.fromWIF(sender.wif)
      keyPairs.push(senderKeyPair)
    }

    let inputsCount = bchUtxos.utxos.length

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      const sendAmount = Math.floor(recipient.amount * (10 ** 8))
      transactionBuilder.addOutput(
        bchjs.Address.toLegacyAddress(recipient.address),
        sendAmount
      )
      outputsCount += 1
      totalOutput += sendAmount
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

      let feeInputContrib = 0
      for (let i = 0; i < feeFunderUtxos.utxos.length; i++) {
        transactionBuilder.addInput(feeFunderUtxos.utxos[i].tx_hash, feeFunderUtxos.utxos[i].tx_pos)
        totalInput += feeFunderUtxos.utxos[i].value
        feeInputContrib += feeFunderUtxos.utxos[i].value
        const feeFunderKeyPair = bchjs.ECPair.fromWIF(feeFunder.wif)
        keyPairs.push(feeFunderKeyPair)
      }

      // Send BCH change back to sender address, if any
      senderRemainder = totalInput - feeInputContrib - totalOutput
      if (senderRemainder > 0) {
        transactionBuilder.addOutput(
          bchjs.Address.toLegacyAddress(sender.address),
          senderRemainder
        )
      }

      const feeFunderRemainder = feeInputContrib - txFee
      if (feeFunderRemainder > 0) {
        transactionBuilder.addOutput(
          bchjs.Address.toLegacyAddress(feeFunder.address),
          feeFunderRemainder
        )
      }
    } else {
      // Send the BCH change back to the wallet, if any
      senderRemainder = totalInput - (totalOutput + txFee)
      if (senderRemainder > 0) {
        transactionBuilder.addOutput(
          bchjs.Address.toLegacyAddress(sender.address),
          senderRemainder
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
        utxo.value
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
