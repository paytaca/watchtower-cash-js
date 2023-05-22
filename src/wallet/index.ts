// const axios = require('axios')

import axios, { AxiosInstance } from "axios";

export class Wallet {
  public _api: AxiosInstance;

  constructor (apiBaseUrl) {
    this._api = axios.create({
      baseURL: apiBaseUrl,
      timeout: 60 * 1000  // 1 minute
    })
  }

  // TODO: define result type
  async getTokens ({ walletHash, tokenType }: { walletHash: string, tokenType: string }): Promise<any> {
    const assets = await this._api.get(`tokens/wallet/${walletHash}/?token_type=${tokenType}`)
    return assets.data
  }

  async scanUtxo (walletHash: string): Promise<{ success: boolean }> {
    const response = await this._api.get(`utxo/wallet/${walletHash}/scan`)
    return response.data
  }

  async getBalance ({ walletHash, tokenId = '', txid = '', index = 0 }: { walletHash: string, tokenId: string, txid: string, index: number }): Promise<{
    valid: boolean,
    wallet: string, // equal to walletHash
    spendable: Number, // denominated in BCH
    balance: Number // denominated in BCH
  }> {
    let balance
    if (tokenId) {
      let url = `balance/wallet/${walletHash}/${tokenId}/`
      if (txid && index) url += `${txid}/${index}/`
      balance = await this._api.get(url)
    } else {
      balance = await this._api.get(`balance/wallet/${walletHash}/`)
    }
    return balance.data
  }

  async getHistory ({ walletHash, tokenId, page, recordType }: { walletHash: string, tokenId: string, page: number, recordType: string }): Promise<    {
    history:
      {
        record_type: 'outgoing' | 'incoming',
        txid: string,
        amount: Number, // denominated in BCH
        tx_fee: 800, // denominated in satoshi
        senders: Array<any[]>,
        recipients: Array<any[]>,
        date_created: string, // ISO encoded datetime
        tx_timestamp: string, // ISO encoded datetime
        usd_price: number,
        market_prices: { [currencyTicker: string]: number },
        attributes: any
      }[],
    page: string, // string representation of number "1"
    num_pages: number, // total pages for pagination
    has_next: boolean, // has next page
  }> {
    if (!page) {
      page = 1
    }
    if (!recordType) {
      recordType = 'all'
    }
    let history
    if (tokenId) {
      history = await this._api.get(`history/wallet/${walletHash}/${tokenId}/?page=${page}&type=${recordType}`)
    } else {
      history = await this._api.get(`history/wallet/${walletHash}/?page=${page}&type=${recordType}`)
    }
    return history.data
  }
}
