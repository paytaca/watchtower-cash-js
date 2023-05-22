import axios, { AxiosInstance, AxiosResponse } from "axios"
import { Address } from "../address"
import OpReturnGenerator from "./op_returns"

import { TransactionTemplateFixed, authenticationTemplateP2pkhNonHd, authenticationTemplateToCompilerBCH, binToHex, cashAddressToLockingBytecode as _cashAddressToLockingBytecode, deriveHdPath, deriveHdPrivateNodeFromSeed, encodeTransaction, generateTransaction, hexToBin, importAuthenticationTemplate, decodePrivateKeyWif, secp256k1, hash160, encodeCashAddress, CashAddressType, CashAddressNetworkPrefix, TransactionGenerationError } from "@bitauth/libauth";
import { mnemonicToSeedSync } from "bip39";

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

export class BCH {
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

  async getBchUtxos (handle: string, value: number): Promise<{
    cumulativeValue: bigint;
    utxos: {
        tx_hash: string;
        tx_pos: number;
        value: bigint;
        wallet_index: string | null;
        address_path: string;
    }[]}> {
    let resp: AxiosResponse<{
      valid: boolean,
      wallet: string,
      utxos: Array<
        {
          txid: string,
          value: number, // denominated in satoshi
          vout: number,
          block: number,
          wallet_index: null,
          address_path: string, // example '0/0'
        }>
    }>
    if (handle.indexOf('wallet:') > -1) {
      resp = await this._api.get(`utxo/wallet/${handle.split('wallet:')[1]}/?value=${value}`)
    } else {
      resp = await this._api.get(`utxo/bch/${handle}/?value=${value}`)
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
          value: BigInt(item.value),
          wallet_index: item.wallet_index,
          address_path: item.address_path
        }
      })
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
  async retrievePrivateKey (mnemonic: string, derivationPath: string, addressPath: string): Promise<Uint8Array> {
    // TODO: replace
    // const seedBuffer = await bchjs.Mnemonic.toSeed(mnemonic)
    const seedBuffer = mnemonicToSeedSync(mnemonic);
    const masterHDNode = deriveHdPrivateNodeFromSeed(new Uint8Array(seedBuffer.buffer), true);
    const child = deriveHdPath(masterHDNode, `${derivationPath}/${addressPath}`);
    if (typeof child === "string") {
      throw new Error(child);
    }

    return child.privateKey;
  }

  async send ({ sender, recipients, feeFunder, changeAddress, broadcast, data }) {
    let walletHash: string;
    if (sender.walletHash !== undefined) {
      walletHash = sender.walletHash
    }

    if (broadcast == undefined) {
      broadcast = true
    }

    let totalSendAmount = 0n
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      if (!new Address(recipient.address).isValidBCHAddress(this.isChipnet)) {
        return {
          success: false,
          error: 'recipient should have a valid BCH address'
        }
      }
      totalSendAmount += BigInt(recipient.amount * 1e8)
    }

    const totalSendAmountSats = totalSendAmount
    let handle
    if (walletHash) {
      handle = 'wallet:' + walletHash
    } else {
      handle = sender.address
    }
    const bchUtxos = await this.getBchUtxos(handle, Number(totalSendAmountSats))
    if (bchUtxos.cumulativeValue < totalSendAmountSats) {
      return {
        success: false,
        error: `not enough balance in sender (${bchUtxos.cumulativeValue}) to cover the send amount (${totalSendAmountSats})`
      }
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

    let totalInput = 0n
    let totalOutput = 0n

    for (let i = 0; i < bchUtxos.utxos.length; i++) {
      totalInput = totalInput + bchUtxos.utxos[i].value

      let inputPrivKey: Uint8Array;
      if (walletHash) {
        let addressPath: string;
        if (bchUtxos.utxos[i].address_path) {
          addressPath = bchUtxos.utxos[i].address_path
        } else {
          addressPath = bchUtxos.utxos[i].wallet_index
        }

        inputPrivKey = await this.retrievePrivateKey(
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

      transaction.inputs.push({
        outpointIndex: bchUtxos.utxos[i].tx_pos,
        outpointTransactionHash: hexToBin(bchUtxos.utxos[i].tx_hash),
        sequenceNumber: 0,
        unlockingBytecode: {
          compiler,
          data: {
            keys: { privateKeys: { key: inputPrivKey } },
          },
          valueSatoshis: bchUtxos.utxos[i].value,
          script: "unlock",
          token: undefined,
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
        lockingBytecode: new Uint8Array(dataOpReturn.buffer),
        valueSatoshis: 0n,
        token: undefined
      });
    }

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      const sendAmount = BigInt(recipient.amount * 1e8)
      transaction.outputs.push({
        lockingBytecode: cashAddressToLockingBytecode(recipient.address).bytecode,
        valueSatoshis: sendAmount,
        token: undefined, // TODO: CashTokens case here
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

    const feeRate = 1.0 // 1.1 sats/byte fee rate

    let txFee = BigInt(Math.ceil(byteCount * feeRate))
    let senderRemainder = 0n

    let feeFunderUtxos
    if (feeFunder !== undefined) {
      feeFunderUtxos = await this.getBchUtxos(feeFunder.address, Number(txFee))
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
