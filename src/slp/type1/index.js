const axios = require('axios')
const BCHJS = require("@psf/bch-js")
const bchjs = new BCHJS()
const OpReturnGenerator = require('./op_returns')

class SlpType1 {

  constructor (apiBaseUrl) {
    this._api = axios.create({
      baseURL: apiBaseUrl
    })
  }

  async getSlpUtxos(address, tokenId, amount) {
    const resp = await this._api.get(`utxo/slp/${address}/${tokenId}`)
    let cumulativeAmount = 0
    let filteredUtxos = []
    const utxos = resp.data.utxos
    for (let i = 0; i < utxos.length; i++) {
      filteredUtxos.push(utxos[i])
      if (cumulativeAmount >= amount) {
        break
      }
    }
    cumulativeAmount = 0
    const finalUtxos = filteredUtxos.map(function (item) {
      const amount = Math.floor(item.amount * (10 ** item.decimals))
      cumulativeAmount += amount
      return {
        tokenId: item.tokenid,
        tx_hash: item.txid,
        tx_pos: item.vout,
        amount: amount,
        value: 546
      }
    })
    return {
      cumulativeAmount: cumulativeAmount,
      utxos: finalUtxos
    }
  }

  async getBchUtxos (address, value) {
    const resp = await this._api.get(`utxo/bch/${address}`)
    let cumulativeValue = 0
    let filteredUtxos = []
    const utxos = resp.data.utxos
    for (let i = 0; i < utxos.length; i++) {
      cumulativeValue += utxos[i].value
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

  async send({ sender, feeFunder, tokenId, recipients, broadcast }) {
    if (broadcast == undefined) {
      broadcast = true
    }

    let totalTokenSendAmounts = 0
    let tokenSendAmounts = recipients.map(function (recipient) {
      totalTokenSendAmounts += recipient.amount
      return recipient.amount
    })

    const slpUtxos = await this.getSlpUtxos(sender.address, tokenId, tokenSendAmounts)
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      if (recipient.address.indexOf('simpleledger') < 0) {
        return {
          success: false,
          error: 'recipient should have an SLP address'
        }
      }
    }

    if (tokenSendAmounts > slpUtxos.cumulativeAmount) {
      return {
        success: false,
        error: `not enough balance (${slpUtxos.cumulativeAmount}) to cover the send amount (${tokenSendAmounts})`
      }
    }

    const slpKeyPair = bchjs.ECPair.fromWIF(sender.wif)
    const keyPairs = []

    let transactionBuilder = new bchjs.TransactionBuilder()
    let outputsCount = 0
    let totalInputSats = 0
    let totalOutputSats = 0

    let totalInputTokens = 0

    for (let i = 0; i < slpUtxos.utxos.length; i++) {
      transactionBuilder.addInput(slpUtxos.utxos[i].tx_hash, slpUtxos.utxos[i].tx_pos)
      totalInputSats += slpUtxos.utxos[i].value
      totalInputTokens += slpUtxos.utxos[i].amount
      keyPairs.push(slpKeyPair)
    }

    let tokenRemainder = totalInputTokens - totalTokenSendAmounts
    if (tokenRemainder > 0) {
      tokenSendAmounts.push(tokenRemainder)
    }

    const slpGen = new OpReturnGenerator()
    const slpSendData = slpGen.generateSendOpReturn(
      {
        tokenId: tokenId,
        sendAmounts: tokenSendAmounts
      }
    )
    transactionBuilder.addOutput(slpSendData, 0)

    recipients.map(function (recipient) {
      transactionBuilder.addOutput(
        bchjs.SLP.Address.toLegacyAddress(recipient.address),
        546
      )
      outputsCount += 1
      totalOutputSats += 546
    })

    if (tokenRemainder > 0) {
      transactionBuilder.addOutput(
        bchjs.SLP.Address.toLegacyAddress(sender.address),
        546
      )
      outputsCount += 1
      totalOutputSats += 546
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
    const txFee = Math.ceil(byteCount * 1.05)  // 1.05 sats/byte fee rate
    const bchUtxos = await this.getBchUtxos(feeFunder.address, txFee)
    const bchKeyPair = bchjs.ECPair.fromWIF(feeFunder.wif)
    
    for (let i = 0; i < bchUtxos.utxos.length; i++) {
      transactionBuilder.addInput(bchUtxos.utxos[i].tx_hash, bchUtxos.utxos[i].tx_pos)
      totalInputSats += bchUtxos.utxos[i].value
      keyPairs.push(bchKeyPair)
    }

    // Last output: send the BCH change back to the wallet.
    const remainderSats = totalInputSats - (totalOutputSats + txFee)

    if (remainderSats > 0) {
      transactionBuilder.addOutput(
        bchjs.Address.toLegacyAddress(feeFunder.address),
        remainderSats
      )
    }

    const combinedUtxos = slpUtxos.utxos.concat(bchUtxos.utxos)

    // Sign each token UTXO being consumed.
    let redeemScript
    for (let i = 0; i < combinedUtxos.length; i++) {
      const thisUtxo = combinedUtxos[i]
      transactionBuilder.sign(
        i,
        keyPairs[i],
        redeemScript,
        transactionBuilder.hashTypes.SIGHASH_ALL,
        thisUtxo.value
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
