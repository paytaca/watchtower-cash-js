const BCHJS = require("@psf/bch-js")
const bchjs = new BCHJS()

class OpReturnGenerator {

  constructor () {}

  async generateSendOpReturn({ label, ticker, docUrl }) {
    try {
      if (docUrl === undefined) {
        docUrl = ''
      }
      const childNftConfig = {
        name: label,
        ticker: ticker,
        documentUrl: docUrl
      };

      const OP_RETURN = await bchjs.SLP.NFT1.generateNFTChildGenesisOpReturn(
        childNftConfig
      );

      return OP_RETURN
    } catch(err) {
      throw err
    }
  }
}

module.exports = OpReturnGenerator
