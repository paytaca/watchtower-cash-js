const slpMdm = require('slp-mdm')
const BigNumber = require('bignumber.js')


class OpReturnGenerator {

  constructor () {}

  generateSendOpReturn({ tokenId, sendAmounts }) {
    try {
      
      let amounts = sendAmounts.map(function (amount) {
        return new BigNumber(amount)
      })

      const script = slpMdm.TokenType1.send(tokenId, amounts)
      return script

    } catch(err) {
      throw err
    }
  }
}

module.exports = OpReturnGenerator
