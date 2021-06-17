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

  async send({ sender, recipients }) {

    let totalSendAmount = 0
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      if (recipient.address.indexOf('bitcoincash') < 0) {
        return {
          success: false,
          error: 'recipient should be a BCH address'
        }
      }
      totalSendAmount += recipient.amount
    }

    const bchUtxos = await this.getBchUtxos(sender.address, totalSendAmount)
    const bchKeyPair = bchjs.ECPair.fromWIF(sender.wif)

    let transactionBuilder = new bchjs.TransactionBuilder()
    let outputsCount = 0
    let totalInput = 0
    let totalOutput = 0
    
    for (let i = 0; i < bchUtxos.utxos.length; i++) {
      transactionBuilder.addInput(bchUtxos.utxos[i].tx_hash, bchUtxos.utxos[i].tx_pos)
      totalInput += bchUtxos.utxos[i].value
    }

    const totalSendAmountSats = totalSendAmount * (10 ** 8)
    if (totalInput < totalSendAmountSats) {
      return {
        success: false,
        error: `not enough balance (${totalInput}) to cover the send amount (${totalSendAmountSats})`
      }
    }

    const inputsCount = bchUtxos.utxos.length

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

    outputsCount += 1  // Add extra for sending the BCH change,if any
    let byteCount = bchjs.BitcoinCash.getByteCount(
      {
        P2PKH: inputsCount
      },
      {
        P2PKH: outputsCount
      }
    )

    const txFee = Math.ceil(byteCount * 1.05)  // 1.05 sats/byte fee rate
    const remainder = totalInput - (totalOutput + txFee)

    // Send the BCH change back to the wallet, if any
    if (remainder > 0) {
      transactionBuilder.addOutput(
        bchjs.Address.toLegacyAddress(sender.address),
        remainder
      )
    }

    // Sign each token UTXO being consumed.
    let redeemScript
    for (let i = 0; i < bchUtxos.utxos.length; i++) {
      const thisUtxo = bchUtxos.utxos[i]
      transactionBuilder.sign(
        i,
        bchKeyPair,
        redeemScript,
        transactionBuilder.hashTypes.SIGHASH_ALL,
        thisUtxo.value
      )
    }

    const tx = transactionBuilder.build()
    const hex = tx.toHex()
    console.debug(`\nRaw Transaction:\n${hex}\n`)

    try {
      const response = await this.broadcastTransaction(hex)
      return response.data
    } catch (error) {
      console.log(bchUtxos)
      return error.response.data
    }

  }

}

module.exports = BCH
