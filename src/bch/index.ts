import axios, { AxiosInstance, AxiosResponse } from "axios"
import Address from "../address/index.js"
import OpReturnGenerator from "./op_returns.js"

import { TransactionTemplateFixed, authenticationTemplateP2pkhNonHd, authenticationTemplateToCompilerBCH, binToHex, cashAddressToLockingBytecode as _cashAddressToLockingBytecode, deriveHdPath, deriveHdPrivateNodeFromSeed, encodeTransaction, generateTransaction, hexToBin, importAuthenticationTemplate, decodePrivateKeyWif, secp256k1, hash160, encodeCashAddress, CashAddressType, CashAddressNetworkPrefix, TransactionGenerationError, readCompactSize, Output, encodePrivateKeyWif } from "@bitauth/libauth";
import { mnemonicToSeedSync } from "bip39";

export interface BchUtxo {
  tx_hash: string;
  tx_pos: number;
  block?: number;
  value: bigint;
  wallet_index: string | null;
  address_path: string;
}

export interface CashtokenUtxo extends BchUtxo {
  amount: bigint
  decimals: number;
  tokenId: string,
  capability: 'none' | 'minting' | 'mutable',
  commitment: string,
  type: 'baton' | 'token',
}

export interface GetBchUtxosResponse {
  cumulativeValue: bigint;
  utxos: BchUtxo[];
}

export interface GetBchUtxosOptions {
  confirmed?: boolean, 
}

export interface GetCashtokensUtxosResponse {
  cumulativeValue: bigint;
  cumulativeTokenAmount: bigint;
  tokenDecimals: number;
  utxos: CashtokenUtxo[]
}

export interface GetCashtokensUtxosOptions extends GetBchUtxosOptions {  
}


// some fields are optional, we can reflect that later
export interface WatchTowerUtxoResponse {
  valid: boolean;
  address: string;
  wallet: string;
  minting_baton?: boolean;
  utxos: Array<{
      txid: string;
      amount: number; // token amount
      value: number; // denominated in satoshi
      vout: number;
      capability: 'none' | 'minting' | 'mutable' | null;
      commitment: string | null; // hex string; example f00d
      cashtoken_nft_details: Object | null;
      token_type: number | null; // slp token type; not relevant for cashtokens
      block: number;
      tokenid: string;
      token_name: string;
      decimals: number;
      token_ticker: string;
      is_cashtoken: boolean;
      wallet_index: null;
      address_path: string; // example '0/0'
    }>
}

export interface Token {
  tokenId: string;
  commitment?: string;
  capability?: string;
  amount?: bigint;
}

export interface Sender {
  walletHash?: string;
  mnemonic?: string;
  derivationPath?: string;
  address?: string;
  wif?: string;
}

export interface Recipient {
  address: string;
  amount?: number; // denominated in BCH
  tokenAmount?: bigint; // denominated in base units, not scaled by decimals
}

export interface SendRequest {
  sender: Sender;
  recipients: Array<Recipient>;
  feeFunder?: Sender;
  changeAddress?: string;
  broadcast?: boolean;
  data?: string;
  token?: Token
}

export interface SendResponse {
  success: boolean;
  transaction?: string;
  fee?: bigint;
  error?: string;
}

const cashAddressToLockingBytecode = (address: string) => {
  const result = _cashAddressToLockingBytecode(address);
  if (typeof result === "string") {
    throw new Error(result);
  }

  return result;
}

const privateKeyToCashaddress = (privateKey: Uint8Array, isChipnet: boolean): string => {
  const publicKeyCompressed = secp256k1.derivePublicKeyCompressed(privateKey);
  if (typeof publicKeyCompressed === "string") {
    throw new Error(publicKeyCompressed);
  }
  const pubKeyHash = hash160(publicKeyCompressed);
  return encodeCashAddress(isChipnet ? CashAddressNetworkPrefix.testnet : CashAddressNetworkPrefix.mainnet, CashAddressType.p2pkh, pubKeyHash);
}

export default class BCH {
  isChipnet: boolean;
  _api: AxiosInstance;
  dustLimit: number;

  constructor (apiBaseUrl, isChipnet) {
    this.isChipnet = isChipnet
    this._api = axios.create({
      baseURL: apiBaseUrl,
      timeout: 60 * 1000  // 1 minute
    })
    this.dustLimit = 546
  }

  async getBchUtxos (handle: string, value: number, opts?: GetBchUtxosOptions): Promise<GetBchUtxosResponse> {
    let resp: AxiosResponse<WatchTowerUtxoResponse>;
    const params = {
      confirmed: opts?.confirmed,
    }

    if (handle.indexOf('wallet:') > -1) {
      resp = await this._api.get(`utxo/wallet/${handle.split('wallet:')[1]}/`, { params })
    } else {
      resp = await this._api.get(`utxo/bch/${handle}/`, { params })
    }
    let cumulativeValue = 0n
    let inputBytes = 0
    let filteredUtxos = []
    const utxos = resp.data.utxos
    for (let i = 0; i < utxos.length; i++) {
      cumulativeValue = cumulativeValue + BigInt(utxos[i].value)
      filteredUtxos.push(utxos[i])
      inputBytes += 180  // average byte size of a single input
      const valuePlusFee = value + inputBytes
      if (cumulativeValue >= valuePlusFee) {
        break
      }
    }
    return {
      cumulativeValue: cumulativeValue,
      utxos: filteredUtxos.map(function (item) {
        return {
          tx_hash: item.txid,
          tx_pos: item.vout,
          block: item.block,
          value: BigInt(item.value),
          wallet_index: item.wallet_index,
          address_path: item.address_path
        }
      })
    }
  }

  async getCashtokensUtxos (handle: string, token: Token, opts?: GetCashtokensUtxosOptions): Promise<GetCashtokensUtxosResponse> {
    let resp: AxiosResponse<WatchTowerUtxoResponse>
    const params = {
      is_cashtoken: true,
      confirmed: opts?.confirmed,
    }

    if (handle.indexOf('wallet:') > -1) {
      // resp = await this._api.get(`utxo/wallet/${handle.split('wallet:')[1]}/${token.tokenId}/?is_cashtoken_nft=true&is_cashtoken=true&baton=${baton}`)
      resp = await this._api.get(`utxo/wallet/${handle.split('wallet:')[1]}/`, { params })
    } else {
      // resp = await this._api.get(`utxo/ct/${handle}/${token.tokenId}/?is_cashtoken_nft=true&is_cashtoken=true&baton=${baton}`)
      resp = await this._api.get(`utxo/ct/${handle}/`, { params })
    }

    let cumulativeValue = 0n
    let cumulativeTokenAmount = 0n
    let tokenDecimals = 0
    let filteredUtxos = []
    const utxos = resp.data.utxos.filter(val => val.commitment === (token.commitment === undefined ? null : token.commitment) && val.capability === (token.capability || null) && val.tokenid === token.tokenId);
    const requiredFtAmount = token.amount || 0n;
    if (utxos.length > 0) {
      tokenDecimals = utxos[0].decimals
    } else {
      return {
        cumulativeValue: 0n,
        cumulativeTokenAmount: 0n,
        tokenDecimals,
        utxos: []
      }
    }

    for (let i = 0; i < utxos.length; i++) {
      filteredUtxos.push(utxos[i])
      cumulativeTokenAmount = cumulativeTokenAmount + BigInt(utxos[i].amount)
      if (cumulativeTokenAmount > requiredFtAmount) {
        break
      }
    }

    const finalUtxos = filteredUtxos.map(function (item) {
      cumulativeValue = cumulativeValue + BigInt(item.value)
      const finalizedUtxoFormat = {
        decimals: item.decimals,
        tokenId: item.tokenid,
        tx_hash: item.txid,
        tx_pos: item.vout,
        block: item.block,
        amount: BigInt(item.amount || 0),
        value: BigInt(item.value),
        wallet_index: item.wallet_index,
        address_path: item.address_path,
        capability: item.capability || undefined,
        commitment: item.commitment !== null ? item.commitment : undefined,
      } as any

      return finalizedUtxoFormat
    })

    return {
      cumulativeValue: cumulativeValue,
      cumulativeTokenAmount: cumulativeTokenAmount,
      tokenDecimals: tokenDecimals,
      utxos: finalUtxos
    }
  }

  async broadcastTransaction (txHex: string): Promise<{
    txid: string
    success: boolean
  } | {
    error: string
  }> {
    const resp = await this._api.post('broadcast/', { transaction: txHex })
    return resp as any
  }

  // Reworked to return private key instead of WIF
  retrievePrivateKey (mnemonic: string, derivationPath: string, addressPath: string): Uint8Array {
    const seedBuffer = mnemonicToSeedSync(mnemonic);
    const masterHDNode = deriveHdPrivateNodeFromSeed(seedBuffer, true);
    const child = deriveHdPath(masterHDNode, `${derivationPath}/${addressPath}`);
    if (typeof child === "string") {
      throw new Error(child);
    }

    return child.privateKey;
  }

  async send ({ sender, recipients, feeFunder, changeAddress, broadcast, data, token }: SendRequest): Promise<SendResponse> {
    if (feeFunder && ((feeFunder.wif && feeFunder.wif === sender.wif) || (feeFunder.mnemonic && feeFunder.mnemonic === sender.mnemonic))) {
      return {
        success: false,
        error: "Using `feeFunder` same as `sender` is not supported"
      }
    }

    let walletHash: string;
    if (sender.walletHash !== undefined) {
      walletHash = sender.walletHash!
    }

    if (broadcast == undefined) {
      broadcast = true
    }

    let handle: string;
    if (walletHash) {
      handle = 'wallet:' + walletHash
    } else {
      handle = sender.address!
    }

    const template = importAuthenticationTemplate(
      authenticationTemplateP2pkhNonHd
    );
    if (typeof template === "string") {
      return {
        success: false,
        error: `Transaction template error`
      }
    }

    const compiler = authenticationTemplateToCompilerBCH(template);

    const transaction: TransactionTemplateFixed<typeof compiler> = {
      inputs: [],
      locktime: 0,
      outputs: [],
      version: 2,
    }

    let combinedUtxos: CashtokenUtxo[] = [];
    // we are sending cashtokens
    if (token?.tokenId) {
      let totalTokenSendAmount = 0n
      recipients.forEach(function (recipient: Recipient) {
        if (recipient.amount === undefined) {
          recipient.tokenAmount = BigInt(recipient.tokenAmount || 0);
        }
        totalTokenSendAmount = totalTokenSendAmount + BigInt(recipient.tokenAmount || 0)
      })

      if (totalTokenSendAmount === 0n && token.commitment === undefined) {
        return {
          success: false,
          error: 'can not send 0 fungible tokens'
        }
      }

      const cashtokensUtxos = await this.getCashtokensUtxos(
        handle,
        {...token, amount: totalTokenSendAmount},
      )

      if (!cashtokensUtxos.utxos.length) {
        return {
          success: false,
          error: 'no suitable utxos were found to spend token'
        }
      }

      if (cashtokensUtxos.cumulativeTokenAmount < totalTokenSendAmount) {
        return {
          success: false,
          error: 'not enough fungible token amount available to send'
        }
      }

      // handle token change
      const diff = cashtokensUtxos.cumulativeTokenAmount - totalTokenSendAmount;
      if (diff > 0) {
        recipients.push({
          address: changeAddress,
          amount: 0, // will be set on the next step,
          tokenAmount: diff
        });
      }

      recipients.forEach(function (recipient) {
        recipient.amount = Number(cashtokensUtxos.utxos[0].value) / 1e8 // convert to BCH
      })

      combinedUtxos = cashtokensUtxos.utxos;
    }

    let totalInput = 0n
    let totalOutput = 0n

    let totalSendAmount = 0n
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      if (!new Address(recipient.address).isValidBCHAddress(this.isChipnet)) {
        return {
          success: false,
          error: 'recipient should have a valid BCH address'
        }
      }
      totalSendAmount += BigInt(Math.round(recipient.amount * 1e8))
    }
    const totalSendAmountSats = totalSendAmount

    const bchUtxos = await this.getBchUtxos(handle, Number(totalSendAmountSats))
    if (bchUtxos.cumulativeValue < totalSendAmountSats) {
      return {
        success: false,
        error: `not enough balance in sender (${bchUtxos.cumulativeValue}) to cover the send amount (${totalSendAmountSats})`
      }
    }

    combinedUtxos.push(...bchUtxos.utxos as any);

    for (let i = 0; i < combinedUtxos.length; i++) {
      totalInput = totalInput + combinedUtxos[i].value

      let inputPrivKey: Uint8Array;
      if (walletHash) {
        let addressPath: string;
        if (combinedUtxos[i].address_path) {
          addressPath = combinedUtxos[i].address_path
        } else {
          addressPath = combinedUtxos[i].wallet_index
        }

        inputPrivKey = this.retrievePrivateKey(
          sender.mnemonic,
          sender.derivationPath,
          addressPath
        )
      } else {
        const decodeResult = decodePrivateKeyWif(sender.wif);
        if (typeof decodeResult === "string") {
          return {
            success: false,
            error: decodeResult
          }
        }
        inputPrivKey = decodeResult.privateKey;
      }

      const libauthToken = combinedUtxos[i].tokenId ? {
        amount: combinedUtxos[i].amount,
        category: hexToBin(combinedUtxos[i].tokenId),
        nft: combinedUtxos[i].commitment !== undefined ? {
          capability: combinedUtxos[i].capability,
          commitment: hexToBin(combinedUtxos[i].commitment)
        } : undefined
      } as Output["token"] : undefined

      transaction.inputs.push({
        outpointIndex: combinedUtxos[i].tx_pos,
        outpointTransactionHash: hexToBin(combinedUtxos[i].tx_hash),
        sequenceNumber: 0,
        unlockingBytecode: {
          compiler,
          data: {
            keys: { privateKeys: { key: inputPrivKey } },
          },
          valueSatoshis: combinedUtxos[i].value,
          script: "unlock",
          token: libauthToken,
        },
      });

      if (!changeAddress) {
        changeAddress = privateKeyToCashaddress(inputPrivKey, this.isChipnet);
      }
    }

    if (data) {
      const dataOpRetGen = new OpReturnGenerator()
      const dataOpReturn = dataOpRetGen.generateDataOpReturn(data)
      transaction.outputs.push({
        lockingBytecode: dataOpReturn,
        valueSatoshis: 0n,
        token: undefined
      });
    }

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      const sendAmount = BigInt(Math.round(recipient.amount * 1e8))

      const libauthToken = recipients[i].tokenAmount !== undefined ? {
        amount: recipients[i].tokenAmount,
        category: hexToBin(token.tokenId),
        nft: token.commitment !== undefined ? {
          capability: token.capability,
          commitment: hexToBin(token.commitment)
        } : undefined
      } as Output["token"] : undefined

      transaction.outputs.push({
        lockingBytecode: cashAddressToLockingBytecode(recipient.address).bytecode,
        valueSatoshis: sendAmount,
        token: libauthToken,
      });

      totalOutput = totalOutput + sendAmount
    }

    const estimatedTransaction = generateTransaction(transaction);

    if (!estimatedTransaction.success) {
      return {
        success: false,
        error: `${JSON.stringify((estimatedTransaction as TransactionGenerationError).errors, null, 2)}`
      }
    }
    const estimatedTransactionBin = encodeTransaction(estimatedTransaction.transaction);
    const byteCount = estimatedTransactionBin.length;

    const feeRate = 1.2 // 1.2 sats/byte fee rate

    let txFee = BigInt(Math.ceil(byteCount * feeRate))
    let senderRemainder = 0n

    if (feeFunder !== undefined) {
      let feeFunderUtxos: GetBchUtxosResponse;

      let feeFunderPrivKey: Uint8Array;
      if (feeFunder.derivationPath) {
        feeFunderPrivKey = this.retrievePrivateKey(feeFunder.mnemonic, feeFunder.derivationPath, '0/0');
        feeFunder.address = privateKeyToCashaddress(feeFunderPrivKey, this.isChipnet);
        feeFunderUtxos = await this.getBchUtxos(`wallet:${feeFunder.walletHash}`, Number(txFee))
      } else {
        const decodeResult = decodePrivateKeyWif(feeFunder.wif);
        if (typeof decodeResult === "string") {
          return {
            success: false,
            error: decodeResult
          }
        }
        feeFunderPrivKey = decodeResult.privateKey;
        feeFunderUtxos = await this.getBchUtxos(feeFunder.address, Number(txFee))
      }

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

      // Send BCH change back to sender address, if any
      senderRemainder = totalInput - totalOutput
      if (senderRemainder >= this.dustLimit) {
        transaction.outputs.push({
          lockingBytecode: cashAddressToLockingBytecode(changeAddress).bytecode,
          valueSatoshis: senderRemainder
        });
      } else {
        txFee += senderRemainder
      }

      let feeInputContrib = 0n
      for (let i = 0; i < feeFunderUtxos.utxos.length; i++) {
        totalInput = totalInput + feeFunderUtxos.utxos[i].value
        feeInputContrib = feeInputContrib + feeFunderUtxos.utxos[i].value

        transaction.inputs.push({
          outpointIndex: feeFunderUtxos.utxos[i].tx_pos,
          outpointTransactionHash: hexToBin(feeFunderUtxos.utxos[i].tx_hash),
          sequenceNumber: 0,
          unlockingBytecode: {
            compiler,
            data: {
              keys: { privateKeys: { key: feeFunderPrivKey } },
            },
            valueSatoshis: combinedUtxos[i].value,
            script: "unlock",
            token: undefined,
          },
        });
      }

      const feeFunderRemainder = feeInputContrib - txFee
      if (feeFunderRemainder > this.dustLimit) {
        transaction.outputs.push({
          lockingBytecode: cashAddressToLockingBytecode(feeFunder.address).bytecode,
          valueSatoshis: feeFunderRemainder,
          token: undefined
        })
      } else {
        txFee += feeFunderRemainder
      }
    } else {
      // Send the BCH change back to the wallet, if any
      senderRemainder = totalInput - (totalOutput + txFee)
      if (senderRemainder >= this.dustLimit) {
        transaction.outputs.push({
          lockingBytecode: cashAddressToLockingBytecode(changeAddress).bytecode,
          valueSatoshis: senderRemainder,
          token: undefined, // no tokens in bch change
        })
      } else {
        const senderRemainderNum = senderRemainder
        if (senderRemainderNum < 0n) {
          return {
            fee: txFee,
            success: false,
            error: `not enough balance in sender (${senderRemainder}) to cover the fee (${txFee})`
          }
        } else {
          txFee += senderRemainderNum
        }
      }
    }

    const result = generateTransaction(transaction);

    if (!result.success) {
      return {
        success: false,
        error: `${JSON.stringify((result as TransactionGenerationError).errors, null, 2)}`
      }
    }
    const hex = binToHex(encodeTransaction(result.transaction));

    if (broadcast) {
      try {
        const response = await this.broadcastTransaction(hex)
        return (response as any).data
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
