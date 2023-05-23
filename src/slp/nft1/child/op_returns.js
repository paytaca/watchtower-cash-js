import BCHJS from "@psf/bch-js"
const bchjs = new BCHJS()

export default class OpReturnGenerator {

  constructor () {}

  generateSendOpReturn (childNftUtxos) {
    try {
      const OP_RETURN = bchjs.SLP.NFT1.generateNFTChildSendOpReturn(childNftUtxos, 1)
      return OP_RETURN.script
    } catch (err) {
      throw err
    }
  }
}
