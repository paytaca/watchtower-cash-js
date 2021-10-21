const BCHJS = require("@psf/bch-js")
const bchjs = new BCHJS()

class OpReturnGenerator {

  constructor () {}

  async generateChildMintOpReturn (label, ticker, docUrl) {
    try {
      const childNftConfig = {
        name: label,
        ticker: ticker,
        documentUrl: docUrl
      }

      const OP_RETURN = await bchjs.SLP.NFT1.generateNFTChildGenesisOpReturn(
        childNftConfig
      )

      return OP_RETURN
    } catch (err) {
      throw err
    }
  }

  generateGroupSendOpReturn (utxos) {
    try {
      const OP_RETURN = bchjs.SLP.NFT1.generateNFTGroupSendOpReturn(utxos, 1)
      return OP_RETURN.script
    } catch (err) {
      throw err
    }
  }

}

module.exports = OpReturnGenerator
