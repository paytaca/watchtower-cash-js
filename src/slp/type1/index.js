const axios = require('axios')
const BCHJS = require("@psf/bch-js")
const bchjs = new BCHJS()
const BigNumber = require('bignumber.js')
const OpReturnGenerator = require('./op_returns')
 
class SlpType1 {

  constructor (apiBaseUrl) {
    this._api = axios.create({
      baseURL: apiBaseUrl,
      timeout: 60 * 1000  // 1 minute
    })
    this.dustLimit = 546
  }

  async getSlpUtxos(handle, tokenId, rawTotalSendAmount) {
    let resp
    if (handle.indexOf('wallet:') > -1) {
      resp = await this._api.get(`utxo/wallet/${handle.split('wallet:')[1]}/${tokenId}/?value=${rawTotalSendAmount}`)
    } else {
      resp = await this._api.get(`utxo/slp/${handle}/${tokenId}/?value=${rawTotalSendAmount}`)
    }
    let cumulativeAmount = new BigNumber(0)
    let tokenDecimals = 0
    let filteredUtxos = []
    const utxos = resp.data.utxos
    if (utxos.length > 0) {
      tokenDecimals = utxos[0].decimals
    } else {
      return {
        cumulativeAmount: cumulativeAmount,
        utxos: []
      }
    }
    for (let i = 0; i < utxos.length; i++) {
      filteredUtxos.push(utxos[i])
      const amount = new BigNumber(utxos[i].amount).times(10 ** tokenDecimals)
      cumulativeAmount = cumulativeAmount.plus(amount)
      const formattedAmount = new BigNumber(rawTotalSendAmount).times(10 ** tokenDecimals)
      if (cumulativeAmount.isGreaterThanOrEqualTo(formattedAmount)) {
        break
      }
    }
    cumulativeAmount = new BigNumber(0)
    const dustLimit = this.dustLimit
    const finalUtxos = filteredUtxos.map(function (item) {
      const amount = new BigNumber(item.amount).times(10 ** item.decimals)
      cumulativeAmount = cumulativeAmount.plus(amount)
      return {
        tokenId: item.tokenid,
        tx_hash: item.txid,
        tx_pos: item.vout,
        amount: amount,
        value: dustLimit,
        wallet_index: item.wallet_index,
        address_path: item.address_path
      }
    })
    return {
      cumulativeAmount: cumulativeAmount,
      convertedSendAmount: new BigNumber(rawTotalSendAmount).times(10 ** tokenDecimals),
      tokenDecimals: tokenDecimals,
      utxos: finalUtxos
    }
  }

  async getBchUtxos (handle, value) {
    let resp
    if (handle.indexOf('wallet:') > -1) {
      resp = await this._api.get(`utxo/wallet/${handle.split('wallet:')[1]}/?value=${value}`)
    } else {
      resp = await this._api.get(`utxo/bch/${handle}/?value=${value}`)
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
          wallet_index: item.wallet_index,
          address_path: item.address_path
        }
      })
    }
  }

  async retrievePrivateKey(mnemonic, derivationPath, addressPath) {
    const seedBuffer = await bchjs.Mnemonic.toSeed(mnemonic)
    const masterHDNode = bchjs.HDNode.fromSeed(seedBuffer)
    const childNode = masterHDNode.derivePath(derivationPath + '/' + addressPath)
    return bchjs.HDNode.toWIF(childNode)
  }

  async broadcastTransaction(txHex) {
    const resp = await this._api.post('broadcast/', { transaction: txHex })
    return resp
  }

  async send({ sender, feeFunder, tokenId, recipients, changeAddresses, broadcast }) {
    let walletHash
    if (sender.walletHash !== undefined) {
      walletHash = sender.walletHash
    }
    if (broadcast === undefined) {
      broadcast = true
    }
    if (!changeAddresses) {
      changeAddresses = {
        slp: null,
        bch: null
      }
    }

    let totalTokenSendAmounts = new BigNumber(0)
    recipients.map(function (recipient) {
      totalTokenSendAmounts = totalTokenSendAmounts.plus(recipient.amount)
      return recipient.amount
    })

    let handle
    if (walletHash) {
      handle = 'wallet:' + walletHash
    } else {
      handle = sender.address
    }
    const slpUtxos = await this.getSlpUtxos(handle, tokenId, totalTokenSendAmounts)
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      if (recipient.address.indexOf('simpleledger') < 0) {
        return {
          success: false,
          error: 'recipient should have an SLP address'
        }
      }
    }

    try {
      if (slpUtxos.convertedSendAmount.isGreaterThan(slpUtxos.cumulativeAmount)) {
        return {
          success: false,
          error: `not enough balance in sender (${slpUtxos.cumulativeAmount}) to cover the send amount (${slpUtxos.convertedSendAmount})`
        }
      }
    } catch (err) {
      return {
        success: false,
        error: 'not enough balance in sender to cover the send amount'
      }
    }

    const keyPairs = []

    let transactionBuilder = new bchjs.TransactionBuilder()
    let outputsCount = 0
    let totalInputSats = new BigNumber(0)
    let totalOutputSats = new BigNumber(0)
    let totalInputTokens = new BigNumber(0)

    let sendAmountsArray = recipients.map(function (recipient) {
      return new BigNumber(recipient.amount).times(10 ** slpUtxos.tokenDecimals)
    })

    for (let i = 0; i < slpUtxos.utxos.length; i++) {
      transactionBuilder.addInput(slpUtxos.utxos[i].tx_hash, slpUtxos.utxos[i].tx_pos)
      totalInputSats = totalInputSats.plus(slpUtxos.utxos[i].value)
      totalInputTokens = totalInputTokens.plus(slpUtxos.utxos[i].amount)
      let utxoKeyPair
      if (walletHash) {
        let addressPath
        if (slpUtxos.utxos[i].address_path) {
          addressPath = slpUtxos.utxos[i].address_path
        } else {
          addressPath = slpUtxos.utxos[i].wallet_index
        }
        const utxoPkWif = await this.retrievePrivateKey(
          sender.mnemonic,
          sender.derivationPath,
          addressPath
        )
        utxoKeyPair = bchjs.ECPair.fromWIF(utxoPkWif)
      } else {
        utxoKeyPair = bchjs.ECPair.fromWIF(sender.wif)
      }
      keyPairs.push(utxoKeyPair)
      if (!changeAddresses.slp) {
        changeAddresses.slp = bchjs.ECPair.toCashAddress(utxoKeyPair)
      }
    }

    let tokenRemainder = totalInputTokens.minus(slpUtxos.convertedSendAmount)
    if (tokenRemainder.isGreaterThan(0)) {
      sendAmountsArray.push(tokenRemainder)
    }
    const slpGen = new OpReturnGenerator()
    const slpSendData = slpGen.generateSendOpReturn(
      {
        tokenId: tokenId,
        sendAmounts: sendAmountsArray
      }
    )
    transactionBuilder.addOutput(slpSendData, 0)
    
    const dustLimit = this.dustLimit
    recipients.map(function (recipient) {
      transactionBuilder.addOutput(
        bchjs.SLP.Address.toLegacyAddress(recipient.address),
        dustLimit
      )
      outputsCount += 1
      totalOutputSats = totalOutputSats.plus(dustLimit)
    })

    if (tokenRemainder.isGreaterThan(0)) {
      transactionBuilder.addOutput(
        bchjs.SLP.Address.toLegacyAddress(changeAddresses.slp),
        dustLimit
      )
      outputsCount += 1
      totalOutputSats = totalOutputSats.plus(dustLimit)
    }

    const inputsCount = slpUtxos.utxos.length + 1  // Add extra for BCH fee funding UTXO
    outputsCount += 2  // Add extra for sending the SLP and BCH changes,if any

    let byteCount = bchjs.BitcoinCash.getByteCount(
      {
        P2PKH: inputsCount
      },
      {
        P2PKH: outputsCount
      }
    )
    byteCount += slpSendData.length  // Account for SLP OP_RETURN data byte count
    const feeRate = 1.2 // 1.2 sats/byte fee rate
    const txFee = Math.ceil(byteCount * feeRate)
    let feeFunderHandle
    if (feeFunder.walletHash) {
      feeFunderHandle = 'wallet:' + feeFunder.walletHash
    } else {
      feeFunderHandle = feeFunder.address
    }
    const bchUtxos = await this.getBchUtxos(feeFunderHandle, txFee)

    if (bchUtxos.cumulativeValue < txFee) {
      return {
        success: false,
        error: `not enough balance in fee funder (${bchUtxos.cumulativeValue}) to cover the fee (${txFee})`
      }
    }
    if (bchUtxos.utxos.length > 2) {
      return {
        success: false,
        error: 'UTXOs of the fee funder are thinly spread out which can cause inaccurate fee computation'
      }
    }

    for (let i = 0; i < bchUtxos.utxos.length; i++) {
      transactionBuilder.addInput(bchUtxos.utxos[i].tx_hash, bchUtxos.utxos[i].tx_pos)
      totalInputSats = totalInputSats.plus(bchUtxos.utxos[i].value)
      let feeFunderutxoKeyPair
      if (feeFunder.walletHash) {
        let addressPath
        if (bchUtxos.utxos[i].address_path) {
          addressPath = bchUtxos.utxos[i].address_path
        } else {
          addressPath = bchUtxos.utxos[i].wallet_index
        }
        const utxoPkWif = await this.retrievePrivateKey(
          feeFunder.mnemonic,
          feeFunder.derivationPath,
          addressPath
        )
        feeFunderutxoKeyPair = bchjs.ECPair.fromWIF(utxoPkWif)
      } else {
        feeFunderutxoKeyPair = bchjs.ECPair.fromWIF(feeFunder.wif)
      }
      keyPairs.push(feeFunderutxoKeyPair)
      if (!changeAddresses.bch) {
        changeAddresses.bch = bchjs.ECPair.toCashAddress(feeFunderutxoKeyPair)
      }
    }

    // Last output: send the BCH change back to the wallet.
    const remainderSats = totalInputSats.minus(totalOutputSats.plus(txFee))

    if (remainderSats.isGreaterThanOrEqualTo(dustLimit)) {
      transactionBuilder.addOutput(
        bchjs.Address.toLegacyAddress(changeAddresses.bch),
        parseInt(remainderSats)
      )
    }

    const combinedUtxos = slpUtxos.utxos.concat(bchUtxos.utxos)

    // Sign each token UTXO being consumed.
    let redeemScript
    for (let i = 0; i < combinedUtxos.length; i++) {
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

module.exports = SlpType1
