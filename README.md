# watchtower-cash-js

Library for building JavaScript applications that integrate with [Watchtower.cash](https://watchtower.cash). Supports BCH transactions, CashTokens, wallet management, and address utilities.

### Install
```bash
npm install watchtower-cash-js
```

### Quick Start
```javascript
import Watchtower from 'watchtower-cash-js'

const watchtower = new Watchtower()           // mainnet
const watchtower = new Watchtower(true)       // chipnet (testnet)
```

### Subscribe an Address
For Watchtower to keep watch of the transactions of an address, it needs to be subscribed.
```javascript
import Watchtower from 'watchtower-cash-js'
const watchtower = new Watchtower()

// Subscribe with a single address
const data = {
  projectId: '0000-0000-0000',
  address: 'bitcoincash:qqz95enwd6qdcy5wnf05hp590sjjknwfuqttev5vyc',
  walletHash: 'abcd0123456',
  walletIndex: 0,
  addressIndex: 0,
  webhookUrl: 'https://xxx.com/webhook-call-receiver',
  chatIdentity: 'user123'
}

// Or subscribe with receiving + change addresses
const data = {
  projectId: '0000-0000-0000',
  addresses: {
    receiving: 'bitcoincash:qqz95enwd6qdcy5wnf05hp590sjjknwfuqttev5vyc',
    change: 'bitcoincash:qzrhqu0jqslzt9kppw8gtwlkhqwnfrn2dc63yv2saj'
  },
  walletHash: 'abcd0123456',
  addressIndex: 0,
  webhookUrl: 'https://xxx.com/webhook-call-receiver'
}

watchtower.subscribe(data).then(result => {
  if (result.success) {
    console.log(result)
  } else {
    console.log(result)
  }
})
```

### Send BCH
```javascript
import Watchtower from 'watchtower-cash-js'
const watchtower = new Watchtower()

const data = {
  sender: {
    address: 'bitcoincash:qqz95enwd6qdcy5wnf05hp590sjjknwfuqttev5vyc',
    wif: 'XXX'
  },
  recipients: [
    {
      address: 'bitcoincash:qpq82xgmau3acnuvypkyj0khks4a6ak7zq7pzjmnfe',
      amount: 0.5
    }
  ],
  feeFunder: {
    address: 'bitcoincash:qr5ntfv5j7308fsuh08sqxkgp9m87cqqtq3rvgnma9',
    wif: 'YYY'
  },
  changeAddress: 'bitcoincash:qzrhqu0jqslzt9kppw8gtwlkhqwnfrn2dc63yv2saj',
  data: 'Hello world!',
  broadcast: true,
  minimizeInputs: true
}

watchtower.BCH.send(data).then(result => {
  if (result.success) {
    console.log(result.txid)
    console.log(result.transaction)
  } else {
    console.log(result.error)
  }
})
```

### Send BCH with HD Wallet
```javascript
import Watchtower from 'watchtower-cash-js'
const watchtower = new Watchtower()

const data = {
  sender: {
    walletHash: '54c7a22cd608b41a4dae441e98d12337b7666f2c0cb6da95e4df3ce7affa467a',
    mnemonic: 'the quick brown fox jumps over the lazy dog',
    derivationPath: "m/44'/145'/0'"
  },
  recipients: [
    {
      address: 'bitcoincash:qpj6d5d6rk4da08pad8lx4swrxlejerfy5v68hz3dj',
      amount: 0.00001
    }
  ],
  broadcast: false
}

watchtower.BCH.send(data).then(result => {
  console.log(result)
})
```

### Send CashTokens
```javascript
import Watchtower from 'watchtower-cash-js'
const watchtower = new Watchtower()

const data = {
  sender: {
    address: 'bitcoincash:zrgzfwc8lx2p8pw7hhghxhshenxa49u0vsfaxlv92w',
    wif: 'XXX'
  },
  token: {
    tokenId: '8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf'
  },
  recipients: [
    {
      address: 'bitcoincash:qq0060pts4sa3txcvnqjnws9cs4hq9w8egzf8xdw2z',
      tokenAmount: 3
    }
  ],
  changeAddress: 'bitcoincash:zrgzfwc8lx2p8pw7hhghxhshenxa49u0vsfaxlv92w',
  broadcast: true
}

watchtower.BCH.send(data).then(result => {
  console.log(result)
})
```

### Send CashTokens with Custom UTXO Selection
```javascript
import Watchtower from 'watchtower-cash-js'
const watchtower = new Watchtower()

const senderAddress = 'bitcoincash:zrgzfwc8lx2p8pw7hhghxhshenxa49u0vsfaxlv92w'
const token = {
  tokenId: '8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf',
  amount: 1
}

const cashtokenUtxos = await watchtower.BCH.getCashtokensUtxos(senderAddress, token)

const data = {
  sender: {
    address: senderAddress,
    wif: 'XXX'
  },
  changeAddress: senderAddress,
  recipients: [{
    address: 'bitcoincash:qq0060pts4sa3txcvnqjnws9cs4hq9w8egzf8xdw2z',
    tokenAmount: 2
  }],
  utxos: cashtokenUtxos.utxos,
  token: token,
  broadcast: false
}

watchtower.BCH.send(data).then(result => {
  console.log(result)
})
```

### Get BCH UTXOs
```javascript
import Watchtower from 'watchtower-cash-js'
const watchtower = new Watchtower()

const address = 'bitcoincash:qrgzfwc8lx2p8pw7hhghxhshenxa49u0vswh4pzr4a'
const value = 0.00001

watchtower.BCH.getBchUtxos(address, value).then(result => {
  console.log(result.cumulativeValue)
  console.log(result.utxos)
})

// With options
watchtower.BCH.getBchUtxos(address, value, { confirmed: true, filterByMinValue: true }).then(result => {
  console.log(result)
})

// Using wallet hash
watchtower.BCH.getBchUtxos('wallet:54c7a22cd608b41a4dae441e98d12337b7666f2c0cb6da95e4df3ce7affa467a', value).then(result => {
  console.log(result)
})
```

### Get CashToken UTXOs
```javascript
import Watchtower from 'watchtower-cash-js'
const watchtower = new Watchtower()

const address = 'bitcoincash:zrgzfwc8lx2p8pw7hhghxhshenxa49u0vsfaxlv92w'
const token = {
  tokenId: '8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf',
  amount: 10
}

watchtower.BCH.getCashtokensUtxos(address, token).then(result => {
  console.log(result.cumulativeValue)
  console.log(result.cumulativeTokenAmount)
  console.log(result.tokenDecimals)
  console.log(result.utxos)
})

// With options
watchtower.BCH.getCashtokensUtxos(address, token, { confirmed: true, filterByMinValue: true }).then(result => {
  console.log(result)
})
```

### Broadcast Transaction
```javascript
import Watchtower from 'watchtower-cash-js'
const watchtower = new Watchtower()

watchtower.BCH.broadcastTransaction('raw_tx_hex').then(result => {
  if (result.success) {
    console.log(result.txid)
  } else {
    console.log(result.error)
  }
})
```

### Wallet Module
```javascript
import Watchtower from 'watchtower-cash-js'
const watchtower = new Watchtower()

const walletHash = '54c7a22cd608b41a4dae441e98d12337b7666f2c0cb6da95e4df3ce7affa467a'

// Get wallet balance
watchtower.Wallet.getBalance({ walletHash }).then(result => {
  console.log(result)
})

// Get token-specific balance
watchtower.Wallet.getBalance({ walletHash, tokenId: '8473d94f...' }).then(result => {
  console.log(result)
})

// Get transaction history
watchtower.Wallet.getHistory({ walletHash }).then(result => {
  console.log(result.history)
  console.log(result.page, result.num_pages, result.has_next)
})

// Get filtered history
watchtower.Wallet.getHistory({ walletHash, tokenId: '8473d94f...', page: 2, recordType: 'incoming' }).then(result => {
  console.log(result)
})

// Get wallet tokens
watchtower.Wallet.getTokens({ walletHash }).then(result => {
  console.log(result)
})

// Trigger UTXO scan
watchtower.Wallet.scanUtxo(walletHash).then(result => {
  console.log(result)
})
```

### Address Utilities
```javascript
import { Address } from 'watchtower-cash-js'

const addr = new Address('bitcoincash:qqz95enwd6qdcy5wnf05hp590sjjknwfuqttev5vyc')

addr.isCashAddress()              // true
addr.isMainnetCashAddress()       // true
addr.isTestnetCashAddress()       // false
addr.isTokenAddress()             // false
addr.isLegacyAddress()            // false
addr.isP2SH()                     // false
addr.isSep20Address()             // false
addr.isValidBCHAddress()          // true
addr.isValidBCHAddress(true)      // true (chipnet validation)

addr.toCashAddress()              // bitcoincash:qqz95enwd6qdcy5wnf05hp590sjjknwfuqttev5vyc
addr.toTokenAddress()             // bitcoincash:zqz95enwd6qdcy5wnf05hp590sjjknwfuqttev5vyc
addr.toLegacyAddress()            // 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2
```

### Derive Addresses from xpub
```javascript
import Watchtower, { Address } from 'watchtower-cash-js'
const watchtower = new Watchtower()

const xpub = 'xpub6ByHsPNSQXTWZ7PLESMY2FufyYWtLXagSUpMQq7Un96SiThZH2iJB1X7pwviH1WtKVeDP6K8d6xxFzzoaFzF3s8BKCZx8oEDdDkNnp4owAZ'
const addressIndex = 0

// Returns { receiving: '<bch-address>', change: '<bch-address>' }
const addresses = Address.fromXpub(xpub, addressIndex)

// For chipnet (testnet)
const chipnetAddresses = Address.fromXpub(xpub, addressIndex, true)

// Subscribe the derived addresses to Watchtower
const subscribeData = {
  projectId: '0000-0000-0000',
  addresses: {
    receiving: addresses.receiving,
    change: addresses.change
  },
  walletHash: 'your-wallet-hash',
  addressIndex: addressIndex,
  webhookUrl: 'https://xxx.com/webhook-call-receiver'
}

watchtower.subscribe(subscribeData).then(result => {
  console.log(result)
})
```

### API Reference

#### `Watchtower`
| Constructor | Description |
|-------------|-------------|
| `new Watchtower(isChipnet?)` | `isChipnet` defaults to `false`. Uses `https://watchtower.cash/api/` for mainnet, `https://chipnet.watchtower.cash/api/` for chipnet. |

**Properties:**
- `watchtower.BCH` — BCH transaction and UTXO module
- `watchtower.Wallet` — Wallet balance, history, and scan module

**Methods:**
- `watchtower.subscribe(data)` — Subscribe an address for transaction monitoring

#### `BCH` Module
| Method | Description |
|--------|-------------|
| `BCH.send(data)` | Send BCH or CashTokens |
| `BCH.getBchUtxos(handle, value, opts?)` | Fetch BCH UTXOs for an address or `wallet:<hash>` |
| `BCH.getCashtokensUtxos(handle, token, opts?)` | Fetch CashToken UTXOs |
| `BCH.broadcastTransaction(txHex, priceId?)` | Broadcast a raw transaction |
| `BCH.sanitizeUtxos({ utxos, value, isCashtoken, minimizeInputs, token })` | Filter and format raw UTXO arrays |
| `BCH.getDustLimit(tokenOutput?)` | Returns dust limit (1000 for token outputs, 546 otherwise) |
| `BCH.retrievePrivateKey(mnemonic, derivationPath, addressPath)` | Derive private key from mnemonic |

#### `Wallet` Module
| Method | Description |
|--------|-------------|
| `Wallet.getBalance({ walletHash, tokenId?, txid?, index? })` | Get wallet or token balance |
| `Wallet.getHistory({ walletHash, tokenId?, page?, recordType?, txSearchReference? })` | Get transaction history with pagination |
| `Wallet.getTokens({ walletHash, tokenType? })` | Get tokens held by wallet |
| `Wallet.scanUtxo(walletHash)` | Trigger UTXO scan for wallet |

#### `Address` Class
Import separately: `import { Address } from 'watchtower-cash-js'`

| Method | Returns |
|--------|---------|
| `Address.fromXpub(xpub, addressIndex?, isChipnet?)` | `{ receiving: string, change: string }` |
| `isCashAddress()` | `boolean` |
| `isMainnetCashAddress()` | `boolean` |
| `isTestnetCashAddress()` | `boolean` |
| `isTokenAddress()` | `boolean` |
| `isLegacyAddress()` | `boolean` |
| `isP2SH()` | `boolean` |
| `isSep20Address()` | `boolean` |
| `isValidBCHAddress(isChipnet?)` | `boolean` |
| `toCashAddress()` | `string` |
| `toTokenAddress()` | `string` |
| `toLegacyAddress()` | `string` |

### TypeScript Interfaces

```typescript
interface Sender {
  walletHash?: string
  mnemonic?: string
  derivationPath?: string
  address?: string
  wif?: string
}

interface Recipient {
  address: string
  amount?: number
  tokenAmount?: bigint
}

interface Token {
  tokenId: string
  commitment?: string
  capability?: 'none' | 'minting' | 'mutable'
  amount?: bigint
  txid?: string
  vout?: number
}

interface SendResponse {
  success: boolean
  transaction?: string
  fee?: bigint
  lackSats?: bigint
  error?: string
}
```

### License
MIT
