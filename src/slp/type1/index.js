import axios from 'axios'
import BigNumber from 'bignumber.js'
import OpReturnGenerator from './op_returns.js'
import Address from '../../address/index.js'
import NftOpReturnGenerator from '../nft1/parent/op_returns.js'
import {
  TransactionTemplateFixed,
  walletTemplateP2pkhNonHd,
  walletTemplateToCompilerBCH,
  binToHex,
  cashAddressToLockingBytecode,
  decodePrivateKeyWif,
  deriveHdPath,
  deriveHdPrivateNodeFromSeed,
  encodeTransaction,
  generateTransaction,
  hexToBin,
  importWalletTemplate,
  secp256k1,
  hash160,
  encodeCashAddress,
  CashAddressType,
  CashAddressNetworkPrefix
} from '@bitauth/libauth'
import { mnemonicToSeedSync } from 'bip39'

const slpOpRetGen = new OpReturnGenerator()

function getNetworkPrefix(isChipnet) {
  return isChipnet ? CashAddressNetworkPrefix.testnet : CashAddressNetworkPrefix.mainnet
}

function privateKeyToCashAddress(privateKey, isChipnet) {
  const publicKeyCompressed = secp256k1.derivePublicKeyCompressed(privateKey)
  if (typeof publicKeyCompressed === 'string') {
    throw new Error(publicKeyCompressed)
  }
  const pubKeyHash = hash160(publicKeyCompressed)
  return encodeCashAddress({
    prefix: getNetworkPrefix(isChipnet),
    type: CashAddressType.p2pkh,
    payload: pubKeyHash
  }).address
}

function toLegacyAddress(address) {
  return new Address(address).toLegacyAddress()
}

function lockingBytecodeFromAddress(address) {
  const result = cashAddressToLockingBytecode(address)
  if (typeof result === 'string') {
    throw new Error(result)
  }
  return result.bytecode
}

function estimateByteCount(inputsCount, outputsCount, opReturnSize = 0) {
  const baseSize = 10 + 
    (inputsCount * 148) + 
    (outputsCount * 34) + 
    opReturnSize
  return baseSize
}

export default class SlpType1 {

  constructor (apiBaseUrl, isChipnet) {
    this.isChipnet = isChipnet
    this._api = axios.create({
      baseURL: apiBaseUrl,
      timeout: 60 * 1000
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

  retrievePrivateKey (mnemonic, derivationPath, addressPath) {
    const seedBuffer = mnemonicToSeedSync(mnemonic)
    const masterHDNode = deriveHdPrivateNodeFromSeed(seedBuffer)
    if (typeof masterHDNode === 'string') {
      throw new Error(masterHDNode)
    }
    const childNode = deriveHdPath(masterHDNode, derivationPath + '/' + addressPath)
    if (typeof childNode === 'string') {
      throw new Error(childNode)
    }
    return childNode.privateKey
  }

  async broadcastTransaction (txHex, priceId) {
    const payload = { transaction: txHex }
    if (priceId !== undefined && priceId !== null) {
      payload.price_id = priceId
    }
    const resp = await this._api.post('broadcast/', payload)
    return resp
  }

  async send ({
    sender,
    feeFunder,
    tokenId,
    recipients,
    changeAddresses,
    broadcast,
    burn = false,
    priceId = null
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

    const template = importWalletTemplate(walletTemplateP2pkhNonHd)
    if (typeof template === 'string') {
      return {
        success: false,
        error: 'Transaction template error'
      }
    }
    const compiler = walletTemplateToCompilerBCH(template)

    const transaction = {
      inputs: [],
      outputs: [],
      locktime: 0,
      version: 2
    }

    let totalInputSats = new BigNumber(0)
    let totalOutputSats = new BigNumber(0)
    let totalInputTokens = new BigNumber(0)

    let sendAmountsArray = recipients.map(function (recipient) {
      return new BigNumber(recipient.amount).times(10 ** slpUtxos.tokenDecimals)
    })

    const privateKeys = []

    for (let i = 0; i < slpUtxos.utxos.length; i++) {
      totalInputSats = totalInputSats.plus(slpUtxos.utxos[i].value)
      totalInputTokens = totalInputTokens.plus(slpUtxos.utxos[i].amount)
      
      let inputPrivKey
      if (walletHash) {
        let addressPath
        if (slpUtxos.utxos[i].address_path) {
          addressPath = slpUtxos.utxos[i].address_path
        } else {
          addressPath = slpUtxos.utxos[i].wallet_index
        }
        inputPrivKey = this.retrievePrivateKey(
          sender.mnemonic,
          sender.derivationPath,
          addressPath
        )
      } else {
        const decodeResult = decodePrivateKeyWif(sender.wif)
        if (typeof decodeResult === 'string') {
          return { success: false, error: decodeResult }
        }
        inputPrivKey = decodeResult.privateKey
      }
      privateKeys.push(inputPrivKey)

      if (!changeAddresses.slp) {
        changeAddresses.slp = privateKeyToCashAddress(inputPrivKey, this.isChipnet)
      }

      transaction.inputs.push({
        outpointIndex: slpUtxos.utxos[i].tx_pos,
        outpointTransactionHash: hexToBin(slpUtxos.utxos[i].tx_hash),
        sequenceNumber: 0,
        unlockingBytecode: {
          compiler,
          data: {
            keys: { privateKeys: { key: inputPrivKey } }
          },
          valueSatoshis: BigInt(slpUtxos.utxos[i].value),
          script: 'unlock'
        }
      })
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
    transaction.outputs.push({
      lockingBytecode: slpOpRetData,
      valueSatoshis: 0n
    })

    const vm = this
    recipients.map(function (recipient) {
      transaction.outputs.push({
        lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(recipient.address)),
        valueSatoshis: BigInt(vm.dustLimit)
      })
      totalOutputSats = totalOutputSats.plus(vm.dustLimit)
    })

    if (tokenRemainder.isGreaterThan(0)) {
      transaction.outputs.push({
        lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(changeAddresses.slp)),
        valueSatoshis: BigInt(vm.dustLimit)
      })
      totalOutputSats = totalOutputSats.plus(vm.dustLimit)
    }

    const inputsCount = slpUtxos.utxos.length + 1
    const outputsCount = transaction.outputs.length + 1
    const opReturnSize = slpOpRetData.length
    let byteCount = estimateByteCount(inputsCount, outputsCount, opReturnSize)
    const feeRate = 1.2
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
      totalInputSats = totalInputSats.plus(bchUtxos.utxos[i].value)
      
      let inputPrivKey
      if (feeFunder.walletHash) {
        let addressPath
        if (bchUtxos.utxos[i].address_path) {
          addressPath = bchUtxos.utxos[i].address_path
        } else {
          addressPath = bchUtxos.utxos[i].wallet_index
        }
        inputPrivKey = this.retrievePrivateKey(
          feeFunder.mnemonic,
          feeFunder.derivationPath,
          addressPath
        )
      } else {
        const decodeResult = decodePrivateKeyWif(feeFunder.wif)
        if (typeof decodeResult === 'string') {
          return { success: false, error: decodeResult }
        }
        inputPrivKey = decodeResult.privateKey
      }
      privateKeys.push(inputPrivKey)

      if (!changeAddresses.bch) {
        changeAddresses.bch = privateKeyToCashAddress(inputPrivKey, this.isChipnet)
      }

      transaction.inputs.push({
        outpointIndex: bchUtxos.utxos[i].tx_pos,
        outpointTransactionHash: hexToBin(bchUtxos.utxos[i].tx_hash),
        sequenceNumber: 0,
        unlockingBytecode: {
          compiler,
          data: {
            keys: { privateKeys: { key: inputPrivKey } }
          },
          valueSatoshis: BigInt(bchUtxos.utxos[i].value),
          script: 'unlock'
        }
      })
    }

    const remainderSats = totalInputSats.minus(totalOutputSats.plus(txFee))

    if (remainderSats.isGreaterThanOrEqualTo(this.dustLimit)) {
      transaction.outputs.push({
        lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(changeAddresses.bch)),
        valueSatoshis: BigInt(remainderSats)
      })
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

    const result = generateTransaction(transaction)
    if (!result.success) {
      return {
        success: false,
        error: JSON.stringify((result).errors, null, 2)
      }
    }
    const hex = binToHex(encodeTransaction(result.transaction))

    if (broadcast) {
      try {
        const response = await this.broadcastTransaction(hex, priceId)
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
    isNftParent = false,
    priceId = null
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

    const template = importWalletTemplate(walletTemplateP2pkhNonHd)
    if (typeof template === 'string') {
      return { success: false, error: 'Transaction template error' }
    }
    const compiler = walletTemplateToCompilerBCH(template)

    const transaction = {
      inputs: [],
      outputs: [],
      locktime: 0,
      version: 2
    }

    let totalInput = new BigNumber(0)
    let totalOutput = new BigNumber(totalSendAmountSats)
    
    const privateKeys = []

    for (let i = 0; i < bchUtxos.utxos.length; i++) {
      totalInput = totalInput.plus(bchUtxos.utxos[i].value)
      
      let inputPrivKey
      if (walletHash) {
        let addressPath
        if (bchUtxos.utxos[i].address_path) {
          addressPath = bchUtxos.utxos[i].address_path
        } else {
          addressPath = bchUtxos.utxos[i].wallet_index
        }
        inputPrivKey = this.retrievePrivateKey(
          creator.mnemonic,
          creator.derivationPath,
          addressPath
        )
        privateKeys.push(inputPrivKey)
        if (!changeAddress) {
          changeAddress = privateKeyToCashAddress(inputPrivKey, this.isChipnet)
        }
      } else {
        const creatorKeyResult = decodePrivateKeyWif(creator.wif)
        if (typeof creatorKeyResult === 'string') {
          return { success: false, error: creatorKeyResult }
        }
        inputPrivKey = creatorKeyResult.privateKey
        privateKeys.push(inputPrivKey)
        if (!changeAddress) {
          changeAddress = privateKeyToCashAddress(inputPrivKey, this.isChipnet)
        }
      }

      transaction.inputs.push({
        outpointIndex: bchUtxos.utxos[i].tx_pos,
        outpointTransactionHash: hexToBin(bchUtxos.utxos[i].tx_hash),
        sequenceNumber: 0,
        unlockingBytecode: {
          compiler,
          data: {
            keys: { privateKeys: { key: inputPrivKey } }
          },
          valueSatoshis: BigInt(bchUtxos.utxos[i].value),
          script: 'unlock'
        }
      })
    }

    let slpCreateData
    if (isNftParent) {
      const nftOpRetGen = new NftOpReturnGenerator()
      slpCreateData = nftOpRetGen.generateGroupCreateOpReturn(
        fixedSupply,
        name,
        ticker,
        docUrl,
        initialQty
      )
    } else {
      slpCreateData = slpOpRetGen.generateGenesisOpReturn(
        fixedSupply,
        name,
        ticker,
        decimals,
        initialQty,
        docUrl,
        docHash
      )
    }
    transaction.outputs.push({
      lockingBytecode: slpCreateData,
      valueSatoshis: 0n
    })
    transaction.outputs.push({
      lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(initialMintRecipient)),
      valueSatoshis: BigInt(this.dustLimit)
    })

    if (!fixedSupply) {
      transaction.outputs.push({
        lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(mintBatonRecipient)),
        valueSatoshis: BigInt(this.dustLimit)
      })
    }

    const inputsCount = bchUtxos.utxos.length + (feeFunder !== undefined ? 1 : 0)
    const outputsCount = transaction.outputs.length + 1
    const opReturnSize = slpCreateData.length
    let byteCount = estimateByteCount(inputsCount, outputsCount, opReturnSize)
    const feeRate = 1.2
    let txFee = Math.ceil(byteCount * feeRate)
    let creatorRemainder = new BigNumber(0)

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

      creatorRemainder = totalInput.minus(totalOutput)
      if (creatorRemainder.isGreaterThanOrEqualTo(this.dustLimit)) {
        transaction.outputs.push({
          lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(changeAddress)),
          valueSatoshis: BigInt(creatorRemainder)
        })
      } else {
        txFee += creatorRemainder.toNumber()
      }
      
      let feeInputContrib = new BigNumber(0)
      for (let i = 0; i < feeFunderUtxos.utxos.length; i++) {
        totalInput = totalInput.plus(feeFunderUtxos.utxos[i].value)
        feeInputContrib = feeInputContrib.plus(feeFunderUtxos.utxos[i].value)
        
        const feeFunderKeyResult = decodePrivateKeyWif(feeFunder.wif)
        if (typeof feeFunderKeyResult === 'string') {
          return { success: false, error: feeFunderKeyResult }
        }
        const feeFunderPrivKey = feeFunderKeyResult.privateKey
        privateKeys.push(feeFunderPrivKey)

        transaction.inputs.push({
          outpointIndex: feeFunderUtxos.utxos[i].tx_pos,
          outpointTransactionHash: hexToBin(feeFunderUtxos.utxos[i].tx_hash),
          sequenceNumber: 0,
          unlockingBytecode: {
            compiler,
            data: {
              keys: { privateKeys: { key: feeFunderPrivKey } }
            },
            valueSatoshis: BigInt(feeFunderUtxos.utxos[i].value),
            script: 'unlock'
          }
        })
      }

      const feeFunderRemainder = feeInputContrib.minus(txFee)
      if (feeFunderRemainder.isGreaterThan(this.dustLimit)) {
        transaction.outputs.push({
          lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(feeFunder.address)),
          valueSatoshis: BigInt(feeFunderRemainder)
        })
      } else {
        txFee += feeFunderRemainder.toNumber()
      }
    } else {
      creatorRemainder = totalInput.minus(totalOutput.plus(txFee))
      if (creatorRemainder.isGreaterThanOrEqualTo(this.dustLimit)) {
        transaction.outputs.push({
          lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(changeAddress)),
          valueSatoshis: BigInt(creatorRemainder)
        })
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

    const result = generateTransaction(transaction)
    if (!result.success) {
      return {
        success: false,
        error: JSON.stringify((result).errors, null, 2)
      }
    }
    const hex = binToHex(encodeTransaction(result.transaction))

    if (broadcast) {
      try {
        const response = await this.broadcastTransaction(hex, priceId)
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
    passMintingBaton = true,
    priceId = null
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

    const template = importWalletTemplate(walletTemplateP2pkhNonHd)
    if (typeof template === 'string') {
      return { success: false, error: 'Transaction template error' }
    }
    const compiler = walletTemplateToCompilerBCH(template)

    const transaction = {
      inputs: [],
      outputs: [],
      locktime: 0,
      version: 2
    }

    let totalInputSats = new BigNumber(0)
    let totalOutputSats = new BigNumber(0)
    let totalInputTokens = new BigNumber(0)

    const privateKeys = []

    for (let i = 0; i < slpUtxos.utxos.length; i++) {
      totalInputSats = totalInputSats.plus(slpUtxos.utxos[i].value)
      totalInputTokens = totalInputTokens.plus(slpUtxos.utxos[i].amount)
      
      let inputPrivKey
      if (walletHash) {
        let addressPath
        if (slpUtxos.utxos[i].address_path) {
          addressPath = slpUtxos.utxos[i].address_path
        } else {
          addressPath = slpUtxos.utxos[i].wallet_index
        }
        inputPrivKey = this.retrievePrivateKey(
          minter.mnemonic,
          minter.derivationPath,
          addressPath
        )
      } else {
        const decodeResult = decodePrivateKeyWif(minter.wif)
        if (typeof decodeResult === 'string') {
          return { success: false, error: decodeResult }
        }
        inputPrivKey = decodeResult.privateKey
      }
      privateKeys.push(inputPrivKey)

      transaction.inputs.push({
        outpointIndex: slpUtxos.utxos[i].tx_pos,
        outpointTransactionHash: hexToBin(slpUtxos.utxos[i].tx_hash),
        sequenceNumber: 0,
        unlockingBytecode: {
          compiler,
          data: {
            keys: { privateKeys: { key: inputPrivKey } }
          },
          valueSatoshis: BigInt(slpUtxos.utxos[i].value),
          script: 'unlock'
        }
      })
    }

    const slpMintData = slpOpRetGen.generateMintOpReturn(
      slpUtxos.utxos,
      quantity
    )
    transaction.outputs.push({
      lockingBytecode: slpMintData,
      valueSatoshis: 0n
    })
    transaction.outputs.push({
      lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(additionalMintRecipient)),
      valueSatoshis: BigInt(this.dustLimit)
    })
    totalOutputSats = totalOutputSats.plus(this.dustLimit)

    if (passMintingBaton) {
      transaction.outputs.push({
        lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(mintBatonRecipient)),
        valueSatoshis: BigInt(this.dustLimit)
      })
      totalOutputSats = totalOutputSats.plus(this.dustLimit)
    }

    const inputsCount = slpUtxos.utxos.length + 1
    const outputsCount = transaction.outputs.length + 1
    const opReturnSize = slpMintData.length
    let byteCount = estimateByteCount(inputsCount, outputsCount, opReturnSize)
    const feeRate = 1.2
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
      totalInputSats = totalInputSats.plus(bchUtxos.utxos[i].value)
      
      let inputPrivKey
      if (feeFunder.walletHash) {
        let addressPath
        if (bchUtxos.utxos[i].address_path) {
          addressPath = bchUtxos.utxos[i].address_path
        } else {
          addressPath = bchUtxos.utxos[i].wallet_index
        }
        inputPrivKey = this.retrievePrivateKey(
          feeFunder.mnemonic,
          feeFunder.derivationPath,
          addressPath
        )
      } else {
        const decodeResult = decodePrivateKeyWif(feeFunder.wif)
        if (typeof decodeResult === 'string') {
          return { success: false, error: decodeResult }
        }
        inputPrivKey = decodeResult.privateKey
      }
      privateKeys.push(inputPrivKey)

      if (!changeAddress) {
        changeAddress = privateKeyToCashAddress(inputPrivKey, this.isChipnet)
      }

      transaction.inputs.push({
        outpointIndex: bchUtxos.utxos[i].tx_pos,
        outpointTransactionHash: hexToBin(bchUtxos.utxos[i].tx_hash),
        sequenceNumber: 0,
        unlockingBytecode: {
          compiler,
          data: {
            keys: { privateKeys: { key: inputPrivKey } }
          },
          valueSatoshis: BigInt(bchUtxos.utxos[i].value),
          script: 'unlock'
        }
      })
    }

    const remainderSats = totalInputSats.minus(totalOutputSats.plus(txFee))
    if (remainderSats.isGreaterThanOrEqualTo(this.dustLimit)) {
      transaction.outputs.push({
        lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(changeAddress)),
        valueSatoshis: BigInt(remainderSats)
      })
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

    const result = generateTransaction(transaction)
    if (!result.success) {
      return {
        success: false,
        error: JSON.stringify((result).errors, null, 2)
      }
    }
    const hex = binToHex(encodeTransaction(result.transaction))

    if (broadcast) {
      try {
        const response = await this.broadcastTransaction(hex, priceId)
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