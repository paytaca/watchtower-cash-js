const BCH = require('./bch')
const SLP = require('./slp')
const axios = require('axios')


const _baseUrl = 'https://watchtower.cash/api/'

class Watchtower {

  constructor () {
    this.BCH = new BCH(_baseUrl)
    this.SLP = new SLP(_baseUrl)
  }

  async subscribe ({ address, projectId, walletHash, webhookCallbackUrl }) {
    if (projectId === undefined) {
      return {
        success: false,
        error: 'Project ID is required, create a project first at watchtower.cash'
      }
    }

    let payload = {
      address: address,
      projectId: projectId
    }
    if (walletHash) {
      payload['wallet_hash'] = walletHash
    }
    if (webhookCallbackUrl) {
      payload['webhook_url'] = webhookCallbackUrl
    }

    const url = _baseUrl + 'subscription/'
    try {
      const resp = await axios.post(url, payload)
      return resp.data
    } catch (error) {
      return error.response.data
    }
  }
}

module.exports = Watchtower
