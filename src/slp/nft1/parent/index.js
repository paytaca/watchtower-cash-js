const axios = require('axios')
const BCHJS = require("@psf/bch-js")
const bchjs = new BCHJS()
const BigNumber = require('bignumber.js')
const OpReturnGenerator = require('./op_returns')
const SlpType1 = require('../../type1/index')

const nftOpRetGen = new OpReturnGenerator()

class SlpNft1Parent {

  constructor (apiBaseUrl) {
    this._api = axios.create({
      baseURL: apiBaseUrl,
      timeout: 60 * 1000  // 1 minute
    })
    this.baseUrl = apiBaseUrl
    this.dustLimit = 546
    this.tokenType = 129
  }

  async getNftUtxos (handle, tokenId, rawTotalSendAmount, isCreatingChildNft, groupBaton = false) {
    let resp
    if (handle.indexOf('wallet:') > -1) {
      resp = await this._api.get(
        `utxo/wallet/${handle.split('wallet:')[1]}/${tokenId}/?&value=${rawTotalSendAmount}&baton=${groupBaton}`
      )
    } else {
      resp = await this._api.get(
        `utxo/slp/${handle}/${tokenId}/?&value=${rawTotalSendAmount}&baton=${groupBaton}`
      )
    }
    let cumulativeAmount = new BigNumber(0)
    let tokenDecimals = 0
    let filteredUtxos = []
    const utxos = resp.data.utxos.filter(u => {
      if (isCreatingChildNft) {
        return u.token_type === this.tokenType && u.amount === 1
      }
      return u.token_type === this.tokenType
    })

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
        tokenQty: Number(amount),
        value: dustLimit,
        type: groupBaton ? 'baton' : 'token',
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

  async getGroupTokenBalance ({ groupTokenId, wallet }) {
    try {
      let resp
      if (wallet.indexOf('simpleledger:') > -1) {
        resp = await this._api.get(`balance/slp/${wallet}/${groupTokenId}/`)
      } else {
        resp = await this._api.get(`balance/wallet/${wallet}/${groupTokenId}/`)
      }
      return {
        success: true,
        balance: resp.data.balance
      }
    } catch (err) {
      return {
        success: false,
        error: err
      }
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

  async retrievePrivateKey (mnemonic, derivationPath, addressPath) {
    const seedBuffer = await bchjs.Mnemonic.toSeed(mnemonic)
    const masterHDNode = bchjs.HDNode.fromSeed(seedBuffer)
    const childNode = masterHDNode.derivePath(derivationPath + '/' + addressPath)
    return bchjs.HDNode.toWIF(childNode)
  }

  async broadcastTransaction (txHex) {
    const resp = await this._api.post('broadcast/', { transaction: txHex })
    return resp
  }

  async generateMintingBatonUtxo ({
    sender,
    feeFunder,
    groupTokenId,
    recipient,
    changeAddress,
    broadcast
  }) {
    const isChildNft = false
    return await this.createChildNftOrMintingBatonUtxo({
      sender,
      feeFunder,
      groupTokenId,
      recipient,
      changeAddress,
      broadcast,
      isChildNft
    })
  }

  async createChildNft ({
    sender,
    feeFunder,
    groupTokenId,
    recipient,
    changeAddress,
    broadcast,
    label,
    ticker,
    docUrl = ''
  }) {
    return await this.createChildNftOrMintingBatonUtxo({
      sender,
      feeFunder,
      groupTokenId,
      recipient,
      changeAddress,
      broadcast,
      label,
      ticker,
      docUrl
    })
  }
  
  async createChildNftOrMintingBatonUtxo ({
    sender,
    feeFunder,
    groupTokenId,
    recipient,
    changeAddress, 
    broadcast,
    label,
    ticker,
    docUrl,
    isChildNft = true
  }) {
    let walletHash
    if (sender.walletHash !== undefined) {
      walletHash = sender.walletHash
    }
    if (broadcast === undefined) {
      broadcast = true
    }

    const totalTokenSendAmount = new BigNumber(1)

    let handle
    if (walletHash) {
      handle = 'wallet:' + walletHash
    } else {
      handle = sender.address
    }

    if (!recipient.startsWith('simpleledger')) {
      return {
        success: false,
        error: 'recipient should have an SLP address'
      }
    }

    const nftUtxos = await this.getNftUtxos(handle, groupTokenId, totalTokenSendAmount, isChildNft)
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
    let inputsCount = 0
    
    let totalInputSats = new BigNumber(0)
    let totalOutputSats = new BigNumber(0)
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

    for (const nftUtxo of nftUtxos.utxos) {
      transactionBuilder.addInput(nftUtxo.tx_hash, nftUtxo.tx_pos)
      keyPairs.push(utxoKeyPair)
      totalInputSats = totalInputSats.plus(nftUtxo.value)
      inputsCount += 1
    }
    inputsCount += 1 // fee funder input

    let hasNftGroupChange = false
    let nftOpReturn

    if (isChildNft) {
      nftOpReturn = await nftOpRetGen.generateChildMintOpReturn(label, ticker, docUrl)
    } else {
      const totalTokenSendAmountTemp = Number(totalTokenSendAmount)
      hasNftGroupChange = nftUtxos.utxos[0].tokenQty !== totalTokenSendAmountTemp
      nftOpReturn = await nftOpRetGen.generateGroupSendOpReturn(nftUtxos.utxos, 1)
    }

    transactionBuilder.addOutput(nftOpReturn, 0)
    transactionBuilder.addOutput(
      bchjs.SLP.Address.toLegacyAddress(recipient),
      this.dustLimit
    )

    if (hasNftGroupChange) {
      transactionBuilder.addOutput(
        bchjs.SLP.Address.toLegacyAddress(sender.address),
        this.dustLimit
      )
      totalOutputSats = totalOutputSats.plus(this.dustLimit)
      outputsCount += 1
    }

    totalOutputSats = totalOutputSats.plus(this.dustLimit)
    outputsCount += 2 // dust output and possible change output

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
    let txFee = Math.ceil(byteCount * feeRate)
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
    
    if (remainderSats.isGreaterThanOrEqualTo(this.dustLimit)) {
      transactionBuilder.addOutput(
        bchjs.Address.toLegacyAddress(changeAddress),
        parseInt(remainderSats)
      )
    } else {
      txFee += remainderSats.toNumber()
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

  async create ({
    creator,
    feeFunder,
    initialMintRecipient,
    mintBatonRecipient,
    changeAddress,
    broadcast,
    name,
    ticker,
    initialQty,
    docUrl = '',
    fixedSupply = false
  }) {
    const slpType1 = new SlpType1(this.baseUrl)
    return await slpType1.create({
      creator,
      feeFunder,
      initialMintRecipient,
      mintBatonRecipient,
      changeAddress,
      broadcast,
      name,
      ticker,
      initialQty,
      docUrl,
      fixedSupply,
      isNftParent: true
    })
  }

  async mint ({
    minter,
    feeFunder,
    tokenId,
    quantity,
    additionalMintRecipient,
    mintBatonRecipient,
    changeAddress,
    broadcast,
    passMintingBaton = true
  }) {
    if (quantity < 1) {
      return {
        success: false,
        error: 'mint amount/quantity must be greater than or equal to 1'
      }
    }

    let walletHash
    if (minter.walletHash !== undefined) {
      walletHash = minter.walletHash
    }
    if (broadcast === undefined) {
      broadcast = true
    }

    let totalTokenSendAmounts = new BigNumber(quantity)
    if (passMintingBaton) {
      if (!mintBatonRecipient.startsWith('simpleledger')) {
        return {
          success: false,
          error: 'mint baton recipient should have an SLP address'
        }
      }
    }

    let handle
    if (walletHash) {
      handle = 'wallet:' + walletHash
    } else {
      handle = minter.address
    }

    if (!additionalMintRecipient.startsWith('simpleledger')) {
      return {
        success: false,
        error: 'additional mint recipient should have an SLP address'
      }
    }
    
    let nftUtxos = await this.getNftUtxos(handle, tokenId, totalTokenSendAmounts, true, true)

    if (nftUtxos.utxos.length === 0) {
      return {
        success: false,
        error: 'no minting baton UTXO in the minter wallet'
      }
    }

    const keyPairs = []

    let transactionBuilder = new bchjs.TransactionBuilder()
    let outputsCount = 0
    let totalInputSats = new BigNumber(0)
    let totalOutputSats = new BigNumber(0)
    let totalInputTokens = new BigNumber(0)

    for (let i = 0; i < nftUtxos.utxos.length; i++) {
      transactionBuilder.addInput(nftUtxos.utxos[i].tx_hash, nftUtxos.utxos[i].tx_pos)
      totalInputSats = totalInputSats.plus(nftUtxos.utxos[i].value)
      totalInputTokens = totalInputTokens.plus(nftUtxos.utxos[i].amount)
      let utxoKeyPair
      if (walletHash) {
        let addressPath
        if (nftUtxos.utxos[i].address_path) {
          addressPath = nftUtxos.utxos[i].address_path
        } else {
          addressPath = nftUtxos.utxos[i].wallet_index
        }
        const utxoPkWif = await this.retrievePrivateKey(
          minter.mnemonic,
          minter.derivationPath,
          addressPath
        )
        utxoKeyPair = bchjs.ECPair.fromWIF(utxoPkWif)
      } else {
        utxoKeyPair = bchjs.ECPair.fromWIF(minter.wif)
      }
      keyPairs.push(utxoKeyPair)
    }

    const nftMintData = nftOpRetGen.generateGroupMintOpReturn(
      nftUtxos.utxos,
      quantity
    )
    transactionBuilder.addOutput(nftMintData, 0)
    transactionBuilder.addOutput(
      bchjs.SLP.Address.toLegacyAddress(additionalMintRecipient),
      this.dustLimit
    )
    totalOutputSats = totalOutputSats.plus(this.dustLimit)
    outputsCount += 2

    if (passMintingBaton) {
      transactionBuilder.addOutput(
        bchjs.SLP.Address.toLegacyAddress(mintBatonRecipient),
        this.dustLimit
      )
      totalOutputSats = totalOutputSats.plus(this.dustLimit)
      outputsCount += 1
    }

    const inputsCount = nftUtxos.utxos.length + 1  // Add extra for BCH fee funding UTXO
    outputsCount += 1  // Add extra for sending BCH change,if any

    let byteCount = bchjs.BitcoinCash.getByteCount(
      {
        P2PKH: inputsCount
      },
      {
        P2PKH: outputsCount
      }
    )
    byteCount += nftMintData.length  // Account for SLP OP_RETURN data byte count
    const feeRate = 1.2 // 1.2 sats/byte fee rate
    let txFee = Math.ceil(byteCount * feeRate)
    let feeFunderHandle
    if (feeFunder.walletHash) {
      feeFunderHandle = 'wallet:' + feeFunder.walletHash
    } else {
      feeFunderHandle = feeFunder.address
    }

    const bchUtxos = await this.getBchUtxos(feeFunderHandle, txFee)

    if (bchUtxos.cumulativeValue < txFee) {
      return {
        fee: txFee,
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
      if (!changeAddress) {
        changeAddress = bchjs.ECPair.toCashAddress(feeFunderutxoKeyPair)
      }
    }

    // Last output: send the BCH change back to the wallet.
    const remainderSats = totalInputSats.minus(totalOutputSats.plus(txFee))
    if (remainderSats.isGreaterThanOrEqualTo(this.dustLimit)) {
      transactionBuilder.addOutput(
        bchjs.Address.toLegacyAddress(changeAddress),
        parseInt(remainderSats)
      )
    } else {
      const remainderSatsNum = remainderSats.toNumber()
      if (remainderSatsNum < 0) {
        return {
          fee: txFee,
          success: false,
          error: `not enough balance in fee funder (${remainderSats}) to cover the fee (${txFee})`
        }
      } else {
        txFee += remainderSatsNum
      }
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

  async send ({
    sender,
    feeFunder,
    tokenId,
    recipients,
    changeAddresses,
    broadcast
  }) {
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
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      if (!recipient.address.startsWith('simpleledger')) {
        return {
          success: false,
          error: 'recipient should have an SLP address'
        }
      }
    }
    
    const nftUtxos = await this.getNftUtxos(handle, groupTokenId, totalTokenSendAmount, false)
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
    let totalInputSats = new BigNumber(0)
    let totalOutputSats = new BigNumber(0)
    let totalInputTokens = new BigNumber(0)

    let sendAmountsArray = recipients.map(function (recipient) {
      return new BigNumber(recipient.amount).times(10 ** nftUtxos.tokenDecimals)
    })

    for (let i = 0; i < nftUtxos.utxos.length; i++) {
      transactionBuilder.addInput(nftUtxos.utxos[i].tx_hash, nftUtxos.utxos[i].tx_pos)
      totalInputSats = totalInputSats.plus(nftUtxos.utxos[i].value)
      totalInputTokens = totalInputTokens.plus(nftUtxos.utxos[i].amount)
      let utxoKeyPair
      if (walletHash) {
        let addressPath
        if (nftUtxos.utxos[i].address_path) {
          addressPath = nftUtxos.utxos[i].address_path
        } else {
          addressPath = nftUtxos.utxos[i].wallet_index
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

    let tokenRemainder = totalInputTokens.minus(nftUtxos.convertedSendAmount)
    if (tokenRemainder.isGreaterThan(0)) {
      sendAmountsArray.push(tokenRemainder)
    }

    const nftOpRetData = nftOpRetGen.generateGroupSendOpReturn(nftUtxos.utxos, totalInputTokens)
    transactionBuilder.addOutput(nftOpRetData, 0)
    outputsCount += 1

    const vm = this
    recipients.map(function (recipient) {
      transactionBuilder.addOutput(
        bchjs.SLP.Address.toLegacyAddress(recipient.address),
        vm.dustLimit
      )
      outputsCount += 1
      totalOutputSats = totalOutputSats.plus(vm.dustLimit)
    })

    if (tokenRemainder.isGreaterThan(0)) {
      transactionBuilder.addOutput(
        bchjs.SLP.Address.toLegacyAddress(changeAddresses.slp),
        this.dustLimit
      )
      outputsCount += 1
      totalOutputSats = totalOutputSats.plus(this.dustLimit)
    }

    const inputsCount = nftUtxos.utxos.length + 1  // Add extra for BCH fee funding UTXO
    outputsCount += 1  // Add extra for sending BCH change,if any

    let byteCount = bchjs.BitcoinCash.getByteCount(
      {
        P2PKH: inputsCount
      },
      {
        P2PKH: outputsCount
      }
    )
    byteCount += nftOpRetData.length  // Account for SLP OP_RETURN data byte count
    const feeRate = 1.2 // 1.2 sats/byte fee rate
    let txFee = Math.ceil(byteCount * feeRate)
    let feeFunderHandle
    if (feeFunder.walletHash) {
      feeFunderHandle = 'wallet:' + feeFunder.walletHash
    } else {
      feeFunderHandle = feeFunder.address
    }
    const bchUtxos = await this.getBchUtxos(feeFunderHandle, txFee)

    if (bchUtxos.cumulativeValue < txFee) {
      return {
        fee: txFee,
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

    if (remainderSats.isGreaterThanOrEqualTo(this.dustLimit)) {
      transactionBuilder.addOutput(
        bchjs.Address.toLegacyAddress(changeAddresses.bch),
        parseInt(remainderSats)
      )
    } else {
      const remainderSatsNum = remainderSats.toNumber()
      if (remainderSatsNum < 0) {
        return {
          fee: txFee,
          success: false,
          error: `not enough balance in sender (${remainderSats}) to cover the fee (${txFee})`
        }
      } else {
        txFee += remainderSatsNum
      }
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

module.exports = SlpNft1Parent
