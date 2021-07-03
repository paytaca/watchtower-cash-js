const axios = require('axios')

class Wallet {
  constructor (apiBaseUrl) {
    this._api = axios.create({
      baseURL: apiBaseUrl
    })
  }

  async getBalance ({ walletHash, tokenId }) {
    console.log('Checking balance...', `balance/wallet/${walletHash}/${tokenId}/`)
    let balance
    if (tokenId) {
      balance = await this._api.get(`balance/wallet/${walletHash}/${tokenId}/`)
    } else {
      balance = await this._api.get(`balance/wallet/${walletHash}/`)
    }
    return balance.data
  }

  async getHistory ({ walletHash, tokenId }) {
    let history
    if (tokenId) {
      history = await this._api.get(`history/wallet/${walletHash}/${tokenId}/`)
    } else {
      history = await this._api.get(`history/wallet/${walletHash}/`)
    }
    return history.data
  }
}

module.exports = Wallet
