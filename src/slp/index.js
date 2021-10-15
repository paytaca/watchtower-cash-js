const SlpType1 = require('./type1')
const SlpNft1Child = require('./nft1/child')
const SlpNft1Parent = require('./nft1/parent')

class SLP {

  constructor (apiBaseUrl) {
    this.Type1 = new SlpType1(apiBaseUrl)
    this.NFT1 = {
      Parent: new SlpNft1Parent(apiBaseUrl),
      Child: new SlpNft1Child(apiBaseUrl)
    }
  }

}

module.exports = SLP
