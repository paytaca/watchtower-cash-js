# watchtower-cash-js

Library for building Javascript applications that integrate with Watchtower.cash

## Install
```
npm install watchtower-cash-js
```

## Sending Type1 SLP Token
```
const Watchtower = require('watchtower')

const watchtower = new Watchtower()

const data = {
    sender: {
        address: 'simpleledger:qqz95enwd6qdcy5wnf05hp590sjjknwfuq8sjhpv6x',
        wif: 'XXX'  // <-- replace with private key WIF
    },
    bchFunder: {
        address: 'bitcoincash:qq46tffgznfew8e78dkyt56k9xcmetnelcma256km7',
        wif: 'YYY' // <-- replace with private key WIF
    },
    tokenId: '7f8889682d57369ed0e32336f8b7e0ffec625a35cca183f4e81fde4e71a538a1',
    amount: 101,
    recipient: 'simpleledger:qpj6d5d6rk4da08pad8lx4swrxlejerfy5qpvvh3nv'
}

watchtower.SLP.Type1.send(data)
```
