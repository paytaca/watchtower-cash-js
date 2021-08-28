const SlpType1 = require('./type1')
const SlpNft1Child = require('./nft1/child')
const SlpNft1Parent = require('./nft1/child')

class SLP {

  constructor (apiBaseUrl) {
    this.Type1 = new SlpType1(apiBaseUrl)
    this.Nft1Parent = new SlpNft1Parent(apiBaseUrl)
    this.Nft1Child = new SlpNft1Child(apiBaseUrl)
  }

}

module.exports = SLP
