const SlpType1 = require('./type1')

class SLP {

  constructor (apiBaseUrl) {
    this.Type1 = new SlpType1(apiBaseUrl)
  }

}

module.exports = SLP
