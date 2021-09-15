const axios = require('axios')

class Wallet {
  constructor (apiBaseUrl) {
    this._api = axios.create({
      baseURL: apiBaseUrl,
      timeout: 60 * 1000  // 1 minute
    })
  }

  async getTokens ({ walletHash, tokenType }) {
    const assets = await this._api.get(`tokens/wallet/${walletHash}/?token_type=${tokenType}`)
    return assets.data
  }

  async getBalance ({ walletHash, tokenId }) {
    let balance
    if (tokenId) {
      balance = await this._api.get(`balance/wallet/${walletHash}/${tokenId}/`)
    } else {
      balance = await this._api.get(`balance/wallet/${walletHash}/`)
    }
    return balance.data
  }

  async getHistory ({ walletHash, tokenId, page }) {
    if (!page) {
      page = 1
    }
    let history
    if (tokenId) {
      history = await this._api.get(`history/wallet/${walletHash}/${tokenId}/?page=${page}`)
    } else {
      history = await this._api.get(`history/wallet/${walletHash}/?page=${page}`)
    }
    return history.data
  }
}

module.exports = Wallet
