const axios = require('axios')
const BCHJS = require("@psf/bch-js")
const bchjs = new BCHJS()

class SLP {

  constructor (apiBaseUrl) {
    this._api = axios.create({
      baseURL: apiBaseUrl
    })
  }

  async getSlpUtxos (address, tokenId, amount) {
    const resp = await this._api.get(`utxo/slp/${address}/${tokenId}`)
    let cumulativeAmount = 0
    let filteredUtxos = []
    const utxos = resp.data.utxos
    for (let i = 0; i < utxos.length; i++) {
      cumulativeAmount += utxos[i].amount
      filteredUtxos.push(utxos[i])
      if (cumulativeAmount >= amount) {
        break
      }
    }
    return filteredUtxos.map(function (item) {
      return {
        tokenId: item.tokenid,
        tx_hash: item.txid,
        tx_pos: item.vout,
        tokenQty: item.amount,
        decimals: item.decimals,
        value: 546
      }
    })
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
          value: item.value
        }
      })
    }
  }

  async broadcastTransaction(txHex) {
    const resp = await this._api.post('broadcast', { transaction: txHex })
    return resp.data.txid
  }

  async sendToken({ sender, bchFunder, tokenId, amount, recipient }) {

    const slpUtxos = await this.getSlpUtxos(sender.address, tokenId, amount)
    const slpKeyPair = bchjs.ECPair.fromWIF(sender.wif)

    const keyPairs = []

    let transactionBuilder = new bchjs.TransactionBuilder()
    let outputsCount = 0

    for (let i = 0; i < slpUtxos.length; i++) {
      transactionBuilder.addInput(slpUtxos[i].tx_hash, slpUtxos[i].tx_pos)
      keyPairs.push(slpKeyPair)
    }

    const slpSendObj = bchjs.SLP.TokenType1.generateSendOpReturn(
      slpUtxos,
      amount
    )
    const slpData = slpSendObj.script
    transactionBuilder.addOutput(slpData, 0)

    transactionBuilder.addOutput(
      bchjs.SLP.Address.toLegacyAddress(recipient),
      546
    )
    outputsCount += 1

    if (slpSendObj.outputs > 1) {
      transactionBuilder.addOutput(
        bchjs.SLP.Address.toLegacyAddress(sender.address),
        546
      )
      outputsCount += 1
    }

    const inputsCount = slpUtxos.length + 1  // Add extra for BCH fee funding UTXO
    let byteCount = bchjs.BitcoinCash.getByteCount(
      {
        P2PKH: inputsCount
      },
      {
        P2PKH: outputsCount + 1  // Add extra for sending the BCH change,if any
      }
    )
    byteCount += slpData.length  // Account for SLP OP_RETURN data byte count
    const txFee = Math.ceil(byteCount * 1.1)  // 1.1 sats/byte fee rate
    const bchUtxos = await this.getBchUtxos(bchFunder.address, txFee)
    const bchKeyPair = bchjs.ECPair.fromWIF(bchFunder.wif)
    const cumulativeValue = bchUtxos.cumulativeValue
    
    for (let i = 0; i < bchUtxos.utxos.length; i++) {
      transactionBuilder.addInput(bchUtxos.utxos[i].tx_hash, bchUtxos.utxos[i].tx_pos)
      keyPairs.push(bchKeyPair)
    }

    // Last output: send the BCH change back to the wallet.
    const remainder = cumulativeValue - txFee
    if (remainder > 0) {
      transactionBuilder.addOutput(
        bchjs.Address.toLegacyAddress(bchFunder.address),
        remainder
      )
    }

    const combinedUtxos = slpUtxos.concat(bchUtxos.utxos)

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
    console.log(`\nTXHEX:\n${hex}`)

    const response = this.broadcastTransaction(hex).then(function (resp) {
      console.log(`\nSUCCESS:\ntxid: ${response.txid}\n`)
    }).catch(function (error) {
      console.log(`\nERROR:\n${error.response.data.error}\n`)
    })

  }

}

module.exports = SLP
