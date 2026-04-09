import {
  CashAddressNetworkPrefix,
  encodeCashAddress,
  CashAddressType,
  decodeCashAddressFormat,
  decodeCashAddressFormatWithoutPrefix,
  decodeCashAddressVersionByte,
  cashAddressTypeBitsToType,
  decodeBase58AddressFormat,
  cashAddressToLockingBytecode,
  lockingBytecodeToBase58Address
} from "@bitauth/libauth";

export default class Address {
  constructor (public address) {
    this.address = address
  }

  isSep20Address () {
    if (typeof(this.address) !== "string") {
      return false;
    }
    if (this.address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
      return true;
    }

    return false;
  }

  isLegacyAddress () {
    try {
      const result = decodeBase58AddressFormat(this.address);
      return typeof result !== "string";
    } catch {
      return false;
    }
  }

  isP2SH() {
    try {
      const decoded = this._decodeCashaddr(this.address);
      return [CashAddressType.p2sh, CashAddressType.p2shWithTokens].includes(decoded.type);
    } catch {
      return false;
    }
  }

  toLegacyAddress () {
    if (this.isLegacyAddress()) {
      return this.address;
    }
    const cashAddr = this.toCashAddress();
    const result = cashAddressToLockingBytecode(cashAddr);
    if (typeof result === "string") {
      throw new Error(result);
    }
    const network = result.prefix === CashAddressNetworkPrefix.testnet ? "testnet" : "mainnet";
    return lockingBytecodeToBase58Address(result.bytecode, network);
  }

  toCashAddress () {
    const decoded = this._decodeCashaddr(this.address);
    const network = Object.keys(CashAddressNetworkPrefix)[Object.values(CashAddressNetworkPrefix).findIndex(val => val === decoded.prefix)];
    const type = decoded.type === CashAddressType.p2pkhWithTokens ? CashAddressType.p2pkh : (
      decoded.type === CashAddressType.p2shWithTokens ? CashAddressType.p2sh : decoded.type
    )
    return encodeCashAddress({ prefix: CashAddressNetworkPrefix[network], type, payload: decoded.payload }).address;
  }

  isCashAddress () {
    try {
      const decoded = this._decodeCashaddr(this.address);
      return Object.values(CashAddressNetworkPrefix).includes(decoded.prefix as any);
    } catch {
      return false;
    }
  }

  isTokenAddress () {
    try {
      const decoded = this._decodeCashaddr(this.address);
      return [CashAddressType.p2pkhWithTokens, CashAddressType.p2shWithTokens].includes(decoded.type);
    } catch {
      return false;
    }
  }

  toTokenAddress () {
    const decoded = this._decodeCashaddr(this.address);
    const network = Object.keys(CashAddressNetworkPrefix)[Object.values(CashAddressNetworkPrefix).findIndex(val => val === decoded.prefix)];
    const type = decoded.type === CashAddressType.p2pkh ? CashAddressType.p2pkhWithTokens : (
      decoded.type === CashAddressType.p2sh ? CashAddressType.p2shWithTokens : decoded.type
    )
    return encodeCashAddress({ prefix: CashAddressNetworkPrefix[network], type, payload: decoded.payload }).address;
  }

  isMainnetCashAddress () {
    try {
      const decoded = this._decodeCashaddr(this.address);
      return decoded.prefix === CashAddressNetworkPrefix.mainnet;
    } catch {
      return false;
    }
  }

  isTestnetCashAddress () {
    try {
      const decoded = this._decodeCashaddr(this.address);
      return decoded.prefix === CashAddressNetworkPrefix.testnet;
    } catch {
      return false;
    }
  }

  isValidBCHAddress (isChipnet = false) {
    if (isChipnet) {
      if (this.isLegacyAddress()) {
        return true;
      } else {
        return this.isCashAddress() || this.isTokenAddress();
      }
    } else {
      return this.isCashAddress() || this.isTokenAddress();
    }
  }

  private _decodeCashaddr(address: string): {
    payload: Uint8Array;
    prefix: string;
    version: number;
    type: CashAddressType;
} {
    let result: any;
    if (this.isLegacyAddress()) {
      const legacyResult = decodeBase58AddressFormat(address);
      if (typeof legacyResult === "string") {
        throw new Error(legacyResult);
      }
      const network = legacyResult.version === 0 ? CashAddressNetworkPrefix.mainnet : 
                      legacyResult.version === 5 ? CashAddressNetworkPrefix.mainnet :
                      CashAddressNetworkPrefix.testnet;
      const type = legacyResult.version === 0 || legacyResult.version === 111 ? CashAddressType.p2pkh : CashAddressType.p2sh;
      address = encodeCashAddress({ prefix: network, type, payload: legacyResult.payload }).address;
    }
    if (address.includes(":")) {
      result = decodeCashAddressFormat(address);
    } else {
      result = decodeCashAddressFormatWithoutPrefix(address);
    }

    if (typeof result === "string") throw new Error(result);

    const info = decodeCashAddressVersionByte(result.version);
    if (typeof info === "string") throw new Error(info);

    const type = cashAddressTypeBitsToType[
      info.typeBits as keyof typeof cashAddressTypeBitsToType
    ] as CashAddressType | undefined;
    if (type === undefined) {
      throw Error("Wrong cashaddress type");
    }

    return {...result, type: type };
  }
}
