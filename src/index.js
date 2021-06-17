const BCH = require('./bch')
const SLP = require('./slp')
const axios = require('axios')


const _baseUrl = 'https://watchtower.cash/api/'

class Watchtower {

  constructor () {
    this.BCH = new BCH(_baseUrl)
    this.SLP = new SLP(_baseUrl)
  }

  async subscribe (address) {
    const url = _baseUrl + 'subscription/'
    try {
      const resp = await axios.post(url, { address: address })
      return resp.data
    } catch (error) {
      return error.response.data
    }
  }
}

module.exports = Watchtower
