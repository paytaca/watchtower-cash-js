import slpMdm from 'slp-mdm'
import BCHJS from "@psf/bch-js"

const bchjs = new BCHJS()

export default class OpReturnGenerator {

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

  generateMintOpReturn(tokenUtxos, tokenQty) {
    try {
      const OP_RETURN = bchjs.SLP.TokenType1.generateMintOpReturn(
        tokenUtxos,
        tokenQty
      )
      return OP_RETURN
    } catch (err) {
      throw err
    }
  }

  generateBurnOpReturn(tokenUtxos, tokenQty) {
    try {
      const OP_RETURN = bchjs.SLP.TokenType1.generateBurnOpReturn(
        tokenUtxos,
        tokenQty
      )
      return OP_RETURN
    } catch (err) {
      throw err
    }
  }

}
