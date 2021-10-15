const axios = require('axios')
const BCHJS = require("@psf/bch-js")
const bchjs = new BCHJS()
const BigNumber = require('bignumber.js')
const OpReturnGenerator = require('./op_returns')

class SlpNft1Child {

  constructor (apiBaseUrl) {
    this._api = axios.create({
      baseURL: apiBaseUrl,
      timeout: 60 * 1000  // 1 minute
    })
    this.dustLimit = 546
  }

  async getNftUtxos(handle, tokenId, rawTotalSendAmount) {
    let resp
    if (handle.indexOf('wallet:') > -1) {
      resp = await this._api.get(`utxo/wallet/${handle.split('wallet:')[1]}/${tokenId}/?token_type=65&value=${rawTotalSendAmount}`)
    } else {
      resp = await this._api.get(`utxo/slp/${handle}/${tokenId}/?token_type=65&value=${rawTotalSendAmount}`)
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
        convertedSendAmount: new BigNumber(rawTotalSendAmount).times(10 ** tokenDecimals),
        utxos: []
      }
    }
    const formattedAmount = new BigNumber(rawTotalSendAmount).times(10 ** tokenDecimals)
    for (let i = 0; i < utxos.length; i++) {
      filteredUtxos.push(utxos[i])
      const amount = new BigNumber(utxos[i].amount).times(10 ** tokenDecimals)
      cumulativeAmount = cumulativeAmount.plus(amount)
      if (cumulativeAmount.isGreaterThanOrEqualTo(formattedAmount)) {
        break
      }
    }
    cumulativeAmount = new BigNumber(0)
    const dustLimit = this.dustLimit
    const finalUtxos = filteredUtxos.map(item => {
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

  async send({
    sender,
    feeFunder,
    tokenId,
    recipient,
    changeAddress, 
    broadcast,
    label,
    ticker,
    docUrl
  }) {
    let walletHash
    if (sender.walletHash !== undefined) {
      walletHash = sender.walletHash
    }
    if (broadcast === undefined) {
      broadcast = true
    }

    let totalTokenSendAmount = new BigNumber(1)

    let handle
    if (walletHash) {
      handle = 'wallet:' + walletHash
    } else {
      handle = sender.address
    }

    if (recipient.indexOf('simpleledger') < 0) {
      return {
        success: false,
        error: 'recipient should have an SLP address'
      }
    }

    const nftUtxos = await this.getNftUtxos(handle, tokenId, totalTokenSendAmount)
    try {
      if (nftUtxos.convertedSendAmount.isGreaterThan(nftUtxos.cumulativeAmount)) {
        return {
          success: false,
          error: `not enough balance in sender (${nftUtxos.cumulativeAmount}) to cover the send amount (${nftUtxos.convertedSendAmount})`
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

    // dont loop through all utxos anymore since the number of utxos returned will always be 1
    // since 1 NFT utxo always has an amount 1 and NFT transactions will always have 1 NFT token amount
    const nftUtxo = nftUtxos.utxos[0]
    
    let totalInputSats = new BigNumber(nftUtxo.value)
    let totalOutputSats = new BigNumber(0)
    let totalInputTokens = new BigNumber(1)

    transactionBuilder.addInput(nftUtxo.tx_hash, nftUtxo.tx_pos)
    
    let utxoKeyPair
    if (walletHash) {
      let addressPath
      if (nftUtxo.address_path) {
        addressPath = nftUtxo.address_path
      } else {
        addressPath = nftUtxo.wallet_index
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

    if (nftDocUrl === undefined) {
      nftDocUrl = ''
    }

    const nftOpRetGen = new OpReturnGenerator()
    const nftOpReturn = await nftOpRetGen.generateSendOpReturn(
      {
        label,
        ticker,
        docUrl
      }
    )
    const dustLimit = this.dustLimit

    transactionBuilder.addOutput(nftOpReturn, 0)
    transactionBuilder.addOutput(
      bchjs.SLP.Address.toLegacyAddress(recipient.address),
      dustLimit
    )
    totalOutputSats = totalOutputSats.plus(dustLimit)
    outputsCount += 1 // dust output

    // always going to be 2 inputs
    // 1 for NFT always (explained in the comment after instantiating the txn builder)
    // 1 for fee funder always since its just the dust
    const inputsCount = 2
    // BCH fee output, no change for NFT (explained in the comment after pushing the fee funder keypair)
    outputsCount += 1 

    let byteCount = bchjs.BitcoinCash.getByteCount(
      {
        P2PKH: inputsCount
      },
      {
        P2PKH: outputsCount
      }
    )
    byteCount += nftOpReturn.length  // Account for NFT OP_RETURN data byte count
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

      // change will always be on the BCH fee funder
      // there are no such thing as change using an NFT transaction token
      if (!changeAddress) {
        changeAddress = bchjs.ECPair.toCashAddress(feeFunderutxoKeyPair)
      }
    }

    // Last output: send the BCH change back to the wallet.
    const remainderSats = totalInputSats.minus(totalOutputSats.plus(txFee))

    if (remainderSats.isGreaterThanOrEqualTo(dustLimit)) {
      transactionBuilder.addOutput(
        bchjs.Address.toLegacyAddress(changeAddress),
        parseInt(remainderSats)
      )
    }

    const combinedUtxos = nftUtxos.utxos.concat(bchUtxos.utxos)

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

    if (broadcast) {
      try {
        const response = await this.broadcastTransaction(hex)
        return response.data
      } catch (error) {
        return error.response.data
      }
    } else {
      return {
        success: true,
        transaction: hex,
        fee: txFee
      }
    }
  }

}

module.exports = SlpNft1Child
