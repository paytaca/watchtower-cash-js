const Watchtower = require('../src')

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
    recipients: [
        {
            address: 'simpleledger:qpq82xgmau3acnuvypkyj0khks4a6ak7zqj6ffwnh8',
            amount: 101
        }
    ]
}

watchtower.SLP.Type1.send(data).then(function (result) {
    console.log(result)
})
