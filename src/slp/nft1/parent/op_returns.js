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

  generateGroupSendOpReturn (utxos, qty) {
    try {
      const OP_RETURN = bchjs.SLP.NFT1.generateNFTGroupSendOpReturn(utxos, qty)
      return OP_RETURN.script
    } catch (err) {
      throw err
    }
  }

  async generateGroupCreateOpReturn (fixedSupply, name, ticker, documentUrl, initialQty) {
    try {
      const config = {
        name,
        ticker,
        documentUrl,
        initialQty
      }
      if (!fixedSupply) {
        config.mintBatonVout = 2
      }

      const OP_RETURN = await bchjs.SLP.NFT1.newNFTGroupOpReturn(config)
      return OP_RETURN
    } catch (err) {
      throw err
    }
  }

  generateGroupMintOpReturn (utxos, qty) {
    try {
      const OP_RETURN = bchjs.SLP.NFT1.mintNFTGroupOpReturn(utxos, qty)
      return OP_RETURN
    } catch (err) {
      throw err
    }
  }

}

module.exports = OpReturnGenerator
