import axios from 'axios'
import BCHJS from "@psf/bch-js"
import BigNumber from 'bignumber.js'
import OpReturnGenerator from './op_returns.js'
import Address from '../../address/index.js'
import NftOpReturnGenerator from '../nft1/parent/op_returns.js'

const bchjs = new BCHJS();

const slpOpRetGen = new OpReturnGenerator()

export default class SlpType1 {

  constructor (apiBaseUrl, isChipnet) {
    this.isChipnet = isChipnet
    this._api = axios.create({
      baseURL: apiBaseUrl,
      timeout: 60 * 1000  // 1 minute
    })
    this.dustLimit = 546
  }

  async getSlpUtxos (handle, tokenId, rawTotalSendAmount, baton = false, burn = false) {
    let resp
    if (handle.indexOf('wallet:') > -1) {
      resp = await this._api.get(
        `utxo/wallet/${handle.split('wallet:')[1]}/${tokenId}/?value=${rawTotalSendAmount}&baton=${baton}`
      )
    } else {
      resp = await this._api.get(
        `utxo/slp/${handle}/${tokenId}/?value=${rawTotalSendAmount}&baton=${baton}`
      )
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
    const vm = this
    cumulativeAmount = new BigNumber(0)
    let finalUtxos = filteredUtxos.map(function (item) {
      const amount = new BigNumber(item.amount).times(10 ** item.decimals)
      cumulativeAmount = cumulativeAmount.plus(amount)
      const finalizedUtxoFormat = {
        decimals: item.decimals,
        tokenId: item.tokenid,
        tx_hash: item.txid,
        tx_pos: item.vout,
        type: baton ? 'baton' : 'token',
        amount: amount,
        value: vm.dustLimit,
        wallet_index: item.wallet_index,
        address_path: item.address_path
      }

      if (burn) {
        finalizedUtxoFormat.qtyStr = String(item.amount)
        finalizedUtxoFormat.tokenQty = item.amount
      }

      return finalizedUtxoFormat
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

  async send ({
    sender,
    feeFunder,
    tokenId,
    recipients,
    changeAddresses,
    broadcast,
    burn = false
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
      if (!new Address(recipient.address).isValidSLPAddress(this.isChipnet)) {
        return {
          success: false,
          error: 'recipient should have a valid SLP address'
        }
      }
    }
    
    const slpUtxos = await this.getSlpUtxos(
      handle,
      tokenId,
      totalTokenSendAmounts,
      false,
      burn
    )
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

    let slpOpRetData
    if (burn) {
      let quantity = sendAmountsArray.reduce((a, b) => a.plus(b))
      quantity = Number(quantity / (10 ** slpUtxos.utxos[0].decimals))
      slpOpRetData = slpOpRetGen.generateBurnOpReturn(
        slpUtxos.utxos,
        quantity
      )
    } else {
      slpOpRetData = slpOpRetGen.generateSendOpReturn(
        {
          tokenId: tokenId,
          sendAmounts: sendAmountsArray
        }
      )
    }
    transactionBuilder.addOutput(slpOpRetData, 0)
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

    const inputsCount = slpUtxos.utxos.length + 1  // Add extra for BCH fee funding UTXO
    outputsCount += 1  // Add extra for sending BCH change,if any

    let byteCount = bchjs.BitcoinCash.getByteCount(
      {
        P2PKH: inputsCount
      },
      {
        P2PKH: outputsCount
      }
    )
    byteCount += slpOpRetData.length  // Account for SLP OP_RETURN data byte count
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
    decimals,
    initialQty,
    docUrl = '',
    docHash = '',
    fixedSupply = false,
    isNftParent = false
  }) {    
    if (fixedSupply) {
      if (initialQty < 1) {
        return {
          success: false,
          error: 'initial quantity must be greater than or equal to 1 on fixed supply'
        } 
      }
    } else {
      if (initialQty < 0) {
        return {
          success: false,
          error: 'initial quantity must be greater than or equal to 0'
        }
      }
    }
    
    let walletHash
    if (creator.walletHash !== undefined) {
      walletHash = creator.walletHash
    }

    if (broadcast == undefined) {
      broadcast = true
    }

    let totalSendAmountSats = this.dustLimit
    if (!fixedSupply) {
      totalSendAmountSats *= 2
      if (!new Address(mintBatonRecipient).isValidSLPAddress(this.isChipnet)) {
        return {
          success: false,
          error: 'mint baton recipient should have a valid SLP address'
        }
      }
    }

    if (!new Address(initialMintRecipient).isValidSLPAddress(this.isChipnet)) {
      return {
        success: false,
        error: 'initial mint recipient should be a valid SLP address'
      }
    }

    let handle
    if (walletHash) {
      handle = 'wallet:' + walletHash
    } else {
      handle = creator.address
    }
    const bchUtxos = await this.getBchUtxos(handle, totalSendAmountSats)
    if (bchUtxos.cumulativeValue < totalSendAmountSats) {
      return {
        success: false,
        error: `not enough balance in creator (${bchUtxos.cumulativeValue}) to cover the create amount (${totalSendAmountSats})`
      }
    }
    
    const keyPairs = []

    let transactionBuilder = new bchjs.TransactionBuilder()
    let outputsCount = 0
    let totalInput = new BigNumber(0)
    let totalOutput = new BigNumber(totalSendAmountSats)
    
    for (let i = 0; i < bchUtxos.utxos.length; i++) {
      transactionBuilder.addInput(bchUtxos.utxos[i].tx_hash, bchUtxos.utxos[i].tx_pos)
      totalInput = totalInput.plus(bchUtxos.utxos[i].value)
      let utxoKeyPair
      if (walletHash) {
        let addressPath
        if (bchUtxos.utxos[i].address_path) {
          addressPath = bchUtxos.utxos[i].address_path
        } else {
          addressPath = bchUtxos.utxos[i].wallet_index
        }
        const utxoPkWif = await this.retrievePrivateKey(
          creator.mnemonic,
          creator.derivationPath,
          addressPath
        )
        utxoKeyPair = bchjs.ECPair.fromWIF(utxoPkWif)
        keyPairs.push(utxoKeyPair)
        if (!changeAddress) {
          changeAddress = bchjs.ECPair.toCashAddress(utxoKeyPair)
        }
      } else {
        const creatorKeyPair = bchjs.ECPair.fromWIF(creator.wif)
        keyPairs.push(creatorKeyPair)
        if (!changeAddress) {
          changeAddress = bchjs.ECPair.toCashAddress(creatorKeyPair)
        }
      }
    }

    let inputsCount = bchUtxos.utxos.length
    let slpCreateData

    if (isNftParent) {
      const nftOpRetGen = new NftOpReturnGenerator()
      slpCreateData = await nftOpRetGen.generateGroupCreateOpReturn(
        fixedSupply,
        name,
        ticker,
        docUrl,
        initialQty
      )
    } else {
      slpCreateData = await slpOpRetGen.generateGenesisOpReturn(
        fixedSupply,
        name,
        ticker,
        decimals,
        initialQty,
        docUrl,
        docHash
      )
    }
    transactionBuilder.addOutput(slpCreateData, 0)
    transactionBuilder.addOutput(
      bchjs.SLP.Address.toLegacyAddress(initialMintRecipient),
      this.dustLimit
    )
    outputsCount += 2

    if (!fixedSupply) {
      transactionBuilder.addOutput(
        bchjs.SLP.Address.toLegacyAddress(mintBatonRecipient),
        this.dustLimit
      )
      outputsCount += 1
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

    const feeRate = 1.2 // 1.2 sats/byte fee rate
    let txFee = Math.ceil(byteCount * feeRate)
    let creatorRemainder = 0

    let feeFunderUtxos
    if (feeFunder !== undefined) {
      feeFunderUtxos = await this.getBchUtxos(feeFunder.address, txFee)
      if (feeFunderUtxos.cumulativeValue < txFee) {
        return {
          fee: txFee,
          success: false,
          error: `not enough balance in fee funder (${feeFunderUtxos.cumulativeValue}) to cover the fee (${txFee})`
        }
      }
      if (feeFunderUtxos.utxos.length > 2) {
        return {
          success: false,
          error: 'UTXOs of your fee funder are thinly spread out which can cause inaccurate fee computation'
        }
      }

      // Send BCH change back to creator address, if any
      creatorRemainder = totalInput.minus(totalOutput)
      if (creatorRemainder.isGreaterThanOrEqualTo(this.dustLimit)) {
        transactionBuilder.addOutput(
          bchjs.Address.toLegacyAddress(changeAddress),
          parseInt(creatorRemainder)
        )
      } else {
        txFee += creatorRemainder.toNumber()
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
      if (feeFunderRemainder.isGreaterThan(this.dustLimit)) {
        transactionBuilder.addOutput(
          bchjs.SLP.Address.toLegacyAddress(feeFunder.address),
          parseInt(feeFunderRemainder)
        )
      } else {
        txFee += feeFunderRemainder.toNumber()
      }
    } else {
      // Send the BCH change back to the wallet, if any
      creatorRemainder = totalInput.minus(totalOutput.plus(txFee))
      if (creatorRemainder.isGreaterThanOrEqualTo(this.dustLimit)) {
        transactionBuilder.addOutput(
          bchjs.Address.toLegacyAddress(changeAddress),
          parseInt(creatorRemainder)
        )
      } else {
        const creatorRemainderNum = creatorRemainder.toNumber()
        if (creatorRemainderNum < 0) {
          return {
            fee: txFee,
            success: false,
            error: `not enough balance in fee funder (${creatorRemainder}) to cover the fee (${txFee})`
          }
        } else {
          txFee += creatorRemainderNum
        }
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
      if (!new Address(mintBatonRecipient).isValidSLPAddress(this.isChipnet)) {
        return {
          success: false,
          error: 'mint baton recipient should have a valid SLP address'
        }
      }
    }

    let handle
    if (walletHash) {
      handle = 'wallet:' + walletHash
    } else {
      handle = minter.address
    }

    if (!new Address(additionalMintRecipient).isValidSLPAddress(this.isChipnet)) {
      return {
        success: false,
        error: 'additional mint recipient should have an SLP address'
      }
    }
    
    let slpUtxos = await this.getSlpUtxos(handle, tokenId, totalTokenSendAmounts, true)
    if (slpUtxos.utxos.length === 0) {
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

    const slpMintData = slpOpRetGen.generateMintOpReturn(
      slpUtxos.utxos,
      quantity
    )
    transactionBuilder.addOutput(slpMintData, 0)
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

    const inputsCount = slpUtxos.utxos.length + 1  // Add extra for BCH fee funding UTXO
    outputsCount += 1  // Add extra for sending BCH change,if any

    let byteCount = bchjs.BitcoinCash.getByteCount(
      {
        P2PKH: inputsCount
      },
      {
        P2PKH: outputsCount
      }
    )
    byteCount += slpMintData.length  // Account for SLP OP_RETURN data byte count
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
