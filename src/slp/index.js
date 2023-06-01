import SlpType1 from './type1/index.js'
import SlpNft1Child from './nft1/child/index.js'
import SlpNft1Parent from './nft1/parent/index.js'

export default class SLP {

  constructor (apiBaseUrl, isChipnet) {
    this.Type1 = new SlpType1(apiBaseUrl, isChipnet)
    this.NFT1 = {
      Parent: new SlpNft1Parent(apiBaseUrl, isChipnet),
      Child: new SlpNft1Child(apiBaseUrl, isChipnet)
    }
  }

}
