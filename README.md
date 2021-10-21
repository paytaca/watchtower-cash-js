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
const data = {
    projectId: '0000-0000-0000',  // <-- Generate this ID by creating a project at Watchtower.cash
    addresses: {
        receiving: 'simpleledger:qqz95enwd6qdcy5wnf05hp590sjjknwfuq8sjhpv6x',
        change: '' // <-- (Optional) If you want to subscribe a change address along with the receiving one
    },
    walletHash: 'abcd0123456', // <-- (Optional) You generate this to track which HD wallet the address belongs to
    addressIndex: 0, // <-- (Optional) The index used to generate this address from HD wallet
    webhookUrl: 'https://xxx.com/webhook-call-receiver'  // <-- (Optional) Your webhook receiver URL
}

watchtower.subscribe(data).then(function (result) {
    if (result.success) {
        // Your logic here when subscription is successful
        console.log(result)
    } else {
        // Your logic here when subscription fails
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
        // <-- You can add more recipients into this array
    ],
    // (Optional) <-- if feeFunder is set, fees will be paid by this address
    feeFunder: {
        address: 'bitcoincash:qr5ntfv5j7308fsuh08sqxkgp9m87cqqtq3rvgnma9',
        wif: 'YYY'  // <-- private key of the feeFunder address
    },
    // (Optional) <-- set a custom change address
    changeAddress: 'bitcoincash:qzrhqu0jqslzt9kppw8gtwlkhqwnfrn2dc63yv2saj'
    // (Optional) <-- Broadcast or just return raw transaction hex
    broadcast: true  // true by default
}

watchtower.BCH.send(data).then(function (result) {
    if (result.success) {
        // Your logic here when send transaction is successful
        console.log(result.txid)

        // or if broadcast is set to false, you can just get the raw transaction hex
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
    tokenId: '7f8889682d57369ed0e32336f8b7e0ffec625a35cca183f4e81fde4e71a538a1',
    recipients: [
        {
            address: 'simpleledger:qpq82xgmau3acnuvypkyj0khks4a6ak7zqj6ffwnh8',
            amount: 101
        } // <-- You can add more recipients into this array
    ],
    // (Optional) <-- if feeFunder is set, fees will be paid by this address
    feeFunder: {
        address: 'bitcoincash:qq46tffgznfew8e78dkyt56k9xcmetnelcma256km7',
        wif: 'YYY' // <-- private key of the feeFunder address
    },
    // (Optional) <-- set a custom change addresses
    changeAddresses: {
        slp: 'simpleledger:qzn4k4lm22rlzlyjccz4r29mz0wpuf9gz5zj2l9w6y',
        bch: 'bitcoincash:qp46gzcw0ycxtnngrhp0xddp2qxnyjnepg2qc02eeh'
    }
    // (Optional) <-- Broadcast or just return raw transaction hex
    broadcast: true  // true by default
}

watchtower.SLP.Type1.send(data).then(function (result) {
    if (result.success) {
        // Your logic here when send transaction is successful
        console.log(result.txid)

        // or if broadcast is set to false, you can just get the raw transaction hex
        console.log(result.transaction)
    } else {
        // Your logic here when send transaction fails
        console.log(result.error)
    }
})
```

### Mint NFT1 Child Token
```javascript
const Watchtower = require('../src')

const watchtower = new Watchtower()

const mintBatonUtxo = {
    sender: {
        address: 'simpleledger:qp3et5cla7jju6z2lfc5v9nr0r4q54edqqdl5mxfjc',
        wif: 'XXX'  // <-- private key of the sender address
    },
    feeFunder: {
        address: 'bitcoincash:qp0wsj9va2srz6vhr6555e2jglm2y3q97vy4eks3gt',
        wif: 'YYY' // <-- private key of the feeFunder address
    },
    groupTokenId: 'f019cfa73559836c13e00d70e7105d4d43377bb6a9861595a7b2373a66aa0bc7', // <-- NFT parent token ID
    recipient: 'simpleledger:qp3et5cla7jju6z2lfc5v9nr0r4q54edqqdl5mxfjc', // <-- only 1 since every NFT is unique and amount is always 1
    // (Optional) <-- set a custom change BCH address (fee funder address by default)
    changeAddress: 'bitcoincash:qp46gzcw0ycxtnngrhp0xddp2qxnyjnepg2qc02eeh',
    // (Optional) <-- Broadcast or just return raw transaction hex
    broadcast: true  // true by default
}

const mintChildData = {
    sender: {
        address: 'simpleledger:qqz95enwd6qdcy5wnf05hp590sjjknwfuq8sjhpv6x',
        wif: 'XXX'  // <-- private key of the sender address
    },
    feeFunder: {
        address: 'bitcoincash:qq46tffgznfew8e78dkyt56k9xcmetnelcma256km7',
        wif: 'YYY' // <-- private key of the feeFunder address
    },
    groupTokenId: '7f8889682d57369ed0e32336f8b7e0ffec625a35cca183f4e81fde4e71a538a1', // <-- NFT parent token ID
    recipient: 'simpleledger:qpq82xgmau3acnuvypkyj0khks4a6ak7zqj6ffwnh8', // <-- only 1 since every NFT is unique and amount is always 1
    label: 'My Unique NFT Token',
    ticker: 'UNI-NFT', // <-- NFT symbol / abbreviation
    docUrl: 'https://uninft.com', // (Optional) <-- Document URL of token
    // (Optional) <-- set a custom change BCH address (fee funder address by default)
    changeAddress: 'bitcoincash:qp46gzcw0ycxtnngrhp0xddp2qxnyjnepg2qc02eeh',
    // (Optional) <-- Broadcast or just return raw transaction hex
    broadcast: true  // true by default

}

watchtower.SLP.NFT1.Parent.generateMintingBatonUtxo(data1).then(result => {
    console.log('MINT baton UTXO result:')
    if (result.success) {
        console.log(result)
        
        watchtower.SLP.NFT1.Parent.mintChildNft(data2).then(result => {
            console.log('MINT Child NFT result')
            console.log(result)

            if (result.success) {
                // Your logic here when send transaction is successful
                console.log(result.txid)

                // or if broadcast is set to false, you can just get the raw transaction hex
                console.log(result.transaction)
            } else {
                // logic when it fails
                console.log(result.error)
            }
        })
    } else {
        console.log(result)
    }
})
```
