const BCH = require('./bch')
const SLP = require('./slp')

class Watchtower {
  constructor () {
    const _baseUrl = 'https://watchtower.cash/api/'

    this.BCH = new BCH(_baseUrl)
    this.SLP = new SLP(_baseUrl)
  }
}

module.exports = Watchtower
