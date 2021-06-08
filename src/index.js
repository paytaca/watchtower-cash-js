const SLP = require('./slp')

class Watchtower {
  constructor () {
    const _baseUrl = 'https://watchtower.cash/api/'

    this.SLP = new SLP(_baseUrl)
  }
}

module.exports = Watchtower
