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

  async send({ sender, amount, recipient }) {

    // const txFee = Math.ceil(byteCount * 1.1)  // 1.1 sats/byte fee rate
    const bchUtxos = await this.getBchUtxos(sender.address, amount)
    const bchKeyPair = bchjs.ECPair.fromWIF(sender.wif)
    const cumulativeValue = bchUtxos.cumulativeValue
    
    for (let i = 0; i < bchUtxos.utxos.length; i++) {
      transactionBuilder.addInput(bchUtxos.utxos[i].tx_hash, bchUtxos.utxos[i].tx_pos)
      keyPairs.push(bchKeyPair)
    }

    let transactionBuilder = new bchjs.TransactionBuilder()
    let outputsCount = 0

    const inputsCount = slpUtxos.length + 1  // Add extra for BCH fee funding UTXO
    let byteCount = bchjs.BitcoinCash.getByteCount(
      {
        P2PKH: inputsCount
      },
      {
        P2PKH: outputsCount + 1  // Add extra for sending the BCH change,if any
      }
    )

    // Last output: send the BCH change back to the wallet.
    const remainder = cumulativeValue - txFee
    if (remainder > 0) {
      transactionBuilder.addOutput(
        bchjs.Address.toLegacyAddress(bchFunder.address),
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
    console.log(`\nTXHEX:\n${hex}`)

    const response = this.broadcastTransaction(hex).then(function (resp) {
      console.log(`\nSUCCESS:\ntxid: ${response.txid}\n`)
    }).catch(function (error) {
      console.log(`\nERROR:\n${error.response.data.error}\n`)
    })

  }

}

module.exports = BCH
