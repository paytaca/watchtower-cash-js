const SlpType1 = require('./type1')
const SlpNft1Child = require('./nft1/child')
const SlpNft1Parent = require('./nft1/parent')

class SLP {

  constructor (apiBaseUrl, isChipnet) {
    this.Type1 = new SlpType1(apiBaseUrl, isChipnet)
    this.NFT1 = {
      Parent: new SlpNft1Parent(apiBaseUrl, isChipnet),
      Child: new SlpNft1Child(apiBaseUrl, isChipnet)
    }
  }

}

module.exports = SLP
