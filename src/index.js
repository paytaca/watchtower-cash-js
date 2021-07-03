const BCH = require('./bch')
const SLP = require('./slp')
const Wallet = require('./wallet')
const axios = require('axios')


const _baseUrl = 'https://watchtower.cash/api/'

class Watchtower {

  constructor () {
    this.BCH = new BCH(_baseUrl)
    this.SLP = new SLP(_baseUrl)
    this.Wallet = new Wallet(_baseUrl)
  }

  _isUUID (uuid) {
    let s = "" + uuid;

    s = s.match('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
    if (s === null) {
      return false;
    }
    return true;
  }

  async subscribe ({ address, projectId, walletHash, walletIndex, webhookUrl }) {
    if (projectId === undefined) {
      return {
        success: false,
        error: 'Project ID is required, create a project first at watchtower.cash'
      }
    }

    if (projectId) {
      if (!this._isUUID(projectId)) {
        return {
          success: false,
          error: 'invalid_project_id'
        }
      }
    }

    let payload = {
      address: address,
      project_id: projectId
    }
    if (walletHash) {
      payload['wallet_hash'] = walletHash
      payload['wallet_index'] = walletIndex
    }
    if (webhookUrl) {
      payload['webhook_url'] = webhookUrl
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
