const slpMdm = require('slp-mdm')
const BCHJS = require("@psf/bch-js")

const bchjs = new BCHJS()

class OpReturnGenerator {

  constructor () {}

  generateSendOpReturn({ tokenId, sendAmounts }) {
    try {
      let amounts = sendAmounts.map(function (amount) {
        return new slpMdm.BN(amount)
      })

      const script = slpMdm.TokenType1.send(tokenId, amounts)
      return script

    } catch (err) {
      throw err
    }
  }

  async generateGenesisOpReturn(
    fixedSupply,
    name,
    ticker,
    decimals,
    initialQty,
    documentUrl,
    documentHash
  ) {
    try {
      const config = {
        name,
        ticker,
        decimals,
        initialQty,
        documentUrl,
        documentHash
      }
      if (!fixedSupply) {
        config.mintBatonVout = 2
      }
      const OP_RETURN = await bchjs.SLP.TokenType1.generateGenesisOpReturn(config)
      return OP_RETURN
    } catch (err) {
      throw err
    }
  }

}

module.exports = OpReturnGenerator
