const Watchtower = require('../src')

const watchtower = new Watchtower()

const data = {
    sender: {
        address: 'simpleledger:qqz95enwd6qdcy5wnf05hp590sjjknwfuq8sjhpv6x',
        wif: 'XXX'  // <-- private key of the sender address
    },
    feeFunder: {
        address: 'bitcoincash:qq46tffgznfew8e78dkyt56k9xcmetnelcma256km7',
        wif: 'YYY' // <-- private key of the feeFunder address
    },
    tokenId: '7f8889682d57369ed0e32336f8b7e0ffec625a35cca183f4e81fde4e71a538a1', // <-- NFT parent token ID
    recipient: 'simpleledger:qpq82xgmau3acnuvypkyj0khks4a6ak7zqj6ffwnh8', // <-- only 1 since every NFT is unique
    label: 'My Unique NFT Token',
    ticker: 'UNI-NFT', // <-- NFT symbol / abbreviation
    docUrl: 'https://uninft.com', // (Optional) <-- Document URL of token
    // (Optional) <-- set a custom change BCH address (fee funder address by default)
    changeAddress: 'bitcoincash:qp46gzcw0ycxtnngrhp0xddp2qxnyjnepg2qc02eeh',
    // (Optional) <-- Broadcast or just return raw transaction hex
    broadcast: true  // true by default

}

watchtower.SLP.NFT1.Child.send(data).then(result => {
    if (result.success) {
        // Your logic here when subscription is successful
        console.log(result)
    } else {
        // Your logic here when subscription fails
        console.log(result)
    }
})
