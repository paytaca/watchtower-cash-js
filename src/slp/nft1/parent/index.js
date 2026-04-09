import axios from 'axios'
import BigNumber from 'bignumber.js'
import OpReturnGenerator from './op_returns.js'
import Address from '../../../address/index.js'
import SlpType1 from '../../type1/index.js'
import {
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

const nftOpRetGen = new OpReturnGenerator()

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

export default class SlpNft1Parent {

  constructor (apiBaseUrl, isChipnet) {
    this.isChipnet = isChipnet
    this._api = axios.create({
      baseURL: apiBaseUrl,
      timeout: 60 * 1000
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
      if (groupBaton) return u.token_type === this.tokenType && u.amount === 0
      if (!u.amount || u.amount <= 0) return false
      return u.token_type === this.tokenType
    })

    if (utxos.length > 0) {
      tokenDecimals = utxos[0].decimals || 0
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
      if (new Address(wallet).isValidSLPAddress(this.isChipnet)) {
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

  async generateMintingBatonUtxo ({
    sender,
    feeFunder,
    groupTokenId,
    recipient,
    changeAddress,
    broadcast,
    priceId = null
  }) {
    const isChildNft = false
    return await this.createChildNftOrMintingBatonUtxo({
      sender,
      feeFunder,
      groupTokenId,
      recipient,
      changeAddress,
      broadcast,
      isChildNft,
      priceId
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
    docUrl = '',
    priceId = null
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
      docUrl,
      priceId
    })
  }

  async findChildNftMintingBaton({
    groupTokenId,
    walletHash,
    address,
  }) {
    const handle = walletHash ? `wallet:${walletHash}` : address
    const totalTokenSendAmount = new BigNumber(1)
    const nftUtxos = await this.getNftUtxos(handle, groupTokenId, totalTokenSendAmount, true)
    return nftUtxos.utxos.find(utxo => utxo.tokenQty === 1)
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
    isChildNft = true,
    priceId = null
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

    if (!new Address(recipient).isValidSLPAddress(this.isChipnet)) {
      return {
        success: false,
        error: 'recipient should have a valid SLP address'
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
    const privateKeys = []

    let inputPrivKey
    if (walletHash) {
      let addressPath
      if (nftUtxos.utxos[0]?.address_path) {
        addressPath = nftUtxos.utxos[0].address_path
      } else {
        addressPath = nftUtxos.utxos[0]?.wallet_index
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

    for (const nftUtxo of nftUtxos.utxos) {
      totalInputSats = totalInputSats.plus(nftUtxo.value)

      transaction.inputs.push({
        outpointIndex: nftUtxo.tx_pos,
        outpointTransactionHash: hexToBin(nftUtxo.tx_hash),
        sequenceNumber: 0,
        unlockingBytecode: {
          compiler,
          data: {
            keys: { privateKeys: { key: inputPrivKey } }
          },
          valueSatoshis: BigInt(nftUtxo.value),
          script: 'unlock'
        }
      })
    }

    let hasNftGroupChange = false
    let nftOpReturn

    if (isChildNft) {
      nftOpReturn = await nftOpRetGen.generateChildMintOpReturn(label, ticker, docUrl)
    } else {
      const totalTokenSendAmountTemp = Number(totalTokenSendAmount)
      hasNftGroupChange = nftUtxos.utxos[0].tokenQty !== totalTokenSendAmountTemp
      nftOpReturn = await nftOpRetGen.generateGroupSendOpReturn(nftUtxos.utxos, 1)
    }

    transaction.outputs.push({
      lockingBytecode: nftOpReturn,
      valueSatoshis: 0n
    })
    transaction.outputs.push({
      lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(recipient)),
      valueSatoshis: BigInt(this.dustLimit)
    })

    if (hasNftGroupChange) {
      transaction.outputs.push({
        lockingBytecode: lockingBytecodeFromAddress(toLegacyAddress(sender.address)),
        valueSatoshis: BigInt(this.dustLimit)
      })
      totalOutputSats = totalOutputSats.plus(this.dustLimit)
    }

    totalOutputSats = totalOutputSats.plus(this.dustLimit)

    const inputsCount = nftUtxos.utxos.length + 1
    const outputsCount = transaction.outputs.length + 1
    const opReturnSize = nftOpReturn.length
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
      
      let feeFunderPrivKey
      if (feeFunder.walletHash) {
        let addressPath
        if (bchUtxos.utxos[i].address_path) {
          addressPath = bchUtxos.utxos[i].address_path
        } else {
          addressPath = bchUtxos.utxos[i].wallet_index
        }
        feeFunderPrivKey = this.retrievePrivateKey(
          feeFunder.mnemonic,
          feeFunder.derivationPath,
          addressPath
        )
      } else {
        const decodeResult = decodePrivateKeyWif(feeFunder.wif)
        if (typeof decodeResult === 'string') {
          return { success: false, error: decodeResult }
        }
        feeFunderPrivKey = decodeResult.privateKey
      }

      if (!changeAddress) {
        changeAddress = privateKeyToCashAddress(feeFunderPrivKey, this.isChipnet)
      }

      transaction.inputs.push({
        outpointIndex: bchUtxos.utxos[i].tx_pos,
        outpointTransactionHash: hexToBin(bchUtxos.utxos[i].tx_hash),
        sequenceNumber: 0,
        unlockingBytecode: {
          compiler,
          data: {
            keys: { privateKeys: { key: feeFunderPrivKey } }
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
      txFee += remainderSats.toNumber()
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
    initialQty,
    docUrl = '',
    fixedSupply = false,
    priceId = null
  }) {
    const slpType1 = new SlpType1(this.baseUrl, this.isChipnet)
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
      isNftParent: true,
      priceId
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
    
    let nftUtxos = await this.getNftUtxos(handle, tokenId, null, false, true)

    if (nftUtxos.utxos.length === 0) {
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

    for (let i = 0; i < nftUtxos.utxos.length; i++) {
      totalInputSats = totalInputSats.plus(nftUtxos.utxos[i].value)
      totalInputTokens = totalInputTokens.plus(nftUtxos.utxos[i].tokenQty)
      
      let inputPrivKey
      if (walletHash) {
        let addressPath
        if (nftUtxos.utxos[i].address_path) {
          addressPath = nftUtxos.utxos[i].address_path
        } else {
          addressPath = nftUtxos.utxos[i].wallet_index
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
        outpointIndex: nftUtxos.utxos[i].tx_pos,
        outpointTransactionHash: hexToBin(nftUtxos.utxos[i].tx_hash),
        sequenceNumber: 0,
        unlockingBytecode: {
          compiler,
          data: {
            keys: { privateKeys: { key: inputPrivKey } }
          },
          valueSatoshis: BigInt(nftUtxos.utxos[i].value),
          script: 'unlock'
        }
      })
    }

    const nftMintData = nftOpRetGen.generateGroupMintOpReturn(
      nftUtxos.utxos,
      quantity
    )
    transaction.outputs.push({
      lockingBytecode: nftMintData,
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

    const inputsCount = nftUtxos.utxos.length + 1
    const outputsCount = transaction.outputs.length + 1
    const opReturnSize = nftMintData.length
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

  async send ({
    sender,
    feeFunder,
    tokenId,
    recipients,
    changeAddresses,
    broadcast,
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
      if (!recipient.address.startsWith('simpleledger')) {
        return {
          success: false,
          error: 'recipient should have an SLP address'
        }
      }
    }
    
    const nftUtxos = await this.getNftUtxos(handle, tokenId, totalTokenSendAmounts, false)
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

    let sendAmountsArray = recipients.map(function (recipient) {
      return new BigNumber(recipient.amount).times(10 ** nftUtxos.tokenDecimals)
    })

    for (let i = 0; i < nftUtxos.utxos.length; i++) {
      totalInputSats = totalInputSats.plus(nftUtxos.utxos[i].value)
      totalInputTokens = totalInputTokens.plus(nftUtxos.utxos[i].tokenQty)
      
      let inputPrivKey
      if (walletHash) {
        let addressPath
        if (nftUtxos.utxos[i].address_path) {
          addressPath = nftUtxos.utxos[i].address_path
        } else {
          addressPath = nftUtxos.utxos[i].wallet_index
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
        outpointIndex: nftUtxos.utxos[i].tx_pos,
        outpointTransactionHash: hexToBin(nftUtxos.utxos[i].tx_hash),
        sequenceNumber: 0,
        unlockingBytecode: {
          compiler,
          data: {
            keys: { privateKeys: { key: inputPrivKey } }
          },
          valueSatoshis: BigInt(nftUtxos.utxos[i].value),
          script: 'unlock'
        }
      })
    }

    let tokenRemainder = totalInputTokens.minus(nftUtxos.convertedSendAmount)
    if (tokenRemainder.isGreaterThan(0)) {
      sendAmountsArray.push(tokenRemainder)
    }

    const nftOpRetData = nftOpRetGen.generateGroupSendOpReturn(nftUtxos.utxos, ...sendAmountsArray)
    transaction.outputs.push({
      lockingBytecode: nftOpRetData,
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

    const inputsCount = nftUtxos.utxos.length + 1
    const outputsCount = transaction.outputs.length + 1
    const opReturnSize = nftOpRetData.length
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
}