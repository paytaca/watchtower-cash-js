const BCH = require('./bch')
const SLP = require('./slp')
const axios = require('axios')

class Watchtower {
  constructor () {
    const _baseUrl = 'https://watchtower.cash/api/'

    this.BCH = new BCH(_baseUrl)
    this.SLP = new SLP(_baseUrl)
  }

  async subscribe (address) {
    const resp = await axios.post(this._baseUrl, { address: address })
    return resp
  }
}

module.exports = Watchtower
