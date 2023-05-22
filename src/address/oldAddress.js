const BCHJS = require("@psf/bch-js")
const bchjs = new BCHJS()

class OldAddress {
  constructor (address) {
    this.address = address
  }

  isLegacyAddress () {
    return bchjs.Address.isLegacyAddress(this.address)
  }

  toLegacyAddress () {
    return bchjs.Address.toLegacyAddress(this.address)
  }

  toCashAddress () {
    return bchjs.Address.toCashAddress(this.address)
  }

  isCashAddress () {
    return bchjs.Address.isCashAddress(this.address)
  }

  isMainnetCashAddress () {
    return bchjs.Address.isMainnetAddress(this.address)
  }

  isTestnetCashAddress () {
    return bchjs.Address.isTestnetAddress(this.address)
  }

  isSLPAddress () {
    return bchjs.SLP.Address.isSLPAddress(this.address)
  }

  toSLPAddress () {
    return bchjs.SLP.Address.toSLPAddress(this.address)
  }

  isMainnetSLPAddress () {
    return bchjs.SLP.Address.isMainnetAddress(this.address)
  }

  isTestnetSLPAddress () {
    return bchjs.SLP.Address.isTestnetAddress(this.address)
  }

  isValidBCHAddress (isChipnet) {
    const isBCHAddr = this.isCashAddress()
    if (isChipnet)
      return isBCHAddr && this.isTestnetCashAddress()
    return isBCHAddr && this.isMainnetCashAddress()
  }

  isValidSLPAddress (isChipnet) {
    const isSLPAddr = this.isSLPAddress()
    if (isChipnet)
      return isSLPAddr && this.isTestnetSLPAddress()
    return isSLPAddr && this.isMainnetSLPAddress()
  }
}

module.exports = OldAddress
