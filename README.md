# watchtower-cash-js

Library for building Javascript applications that integrate with Watchtower.cash

### Install
```bash
npm install watchtower-cash-js
```

### Subscribe an Address
For Watchtower to keep watch of the transactions of an address, it needs to be subscribed. A convenient function is included here to subscribe an address.
```javascript
const Watchtower = require('watchtower-cash-js')

const watchtower = new Watchtower()

// Subscribe function accepts either BCH or SLP address
let address = 'simpleledger:qqz95enwd6qdcy5wnf05hp590sjjknwfuq8sjhpv6x'
watchtower.subscribe(address).then(function (result) {
    if (result.success) {
        // Your logic here when send transaction is successful
        console.log(result)
    } else {
        // Your logic here when send transaction fails
        console.log(result)
    }
})
```

### Sending BCH
```javascript
const Watchtower = require('watchtower-cash-js')

const watchtower = new Watchtower()

const data = {
    sender: {
        address: 'bitcoincash:qqz95enwd6qdcy5wnf05hp590sjjknwfuqttev5vyc',
        wif: 'XXX'  // <-- private key of the sender address
    },
    recipients: [
        {
            address: 'bitcoincash:qpq82xgmau3acnuvypkyj0khks4a6ak7zq7pzjmnfe',
            amount: 0.5
        }
    ],
    broadcast: true  // true by default
}

watchtower.BCH.send(data).then(function (result) {
    if (result.success) {
        // Your logic here when send transaction is successful
        console.log(result.txid)

        // or if broadcast is set to false, you can get the raw transaction hex by
        console.log(result.transaction)
    } else {
        // Your logic here when send transaction fails
        console.log(result.error)
    }
})
```

### Sending Type1 SLP Token
```javascript
const Watchtower = require('watchtower-cash-js')

const watchtower = new Watchtower()

const data = {
    sender: {
        address: 'simpleledger:qqz95enwd6qdcy5wnf05hp590sjjknwfuq8sjhpv6x',
        wif: 'XXX'  // <-- private key of the sender address
    },
    bchFunder: {
        address: 'bitcoincash:qq46tffgznfew8e78dkyt56k9xcmetnelcma256km7',
        wif: 'YYY' // <-- private key of the bchFunder address
    },
    tokenId: '7f8889682d57369ed0e32336f8b7e0ffec625a35cca183f4e81fde4e71a538a1',
    amount: 101,
    recipient: 'simpleledger:qpq82xgmau3acnuvypkyj0khks4a6ak7zqj6ffwnh8'
}

watchtower.SLP.Type1.send(data).then(function (result) {
    if (result.success) {
        // Your logic here when send transaction is successful
        console.log(result.txid)
    } else {
        // Your logic here when send transaction fails
        console.log(result.error)
    }
})
```
