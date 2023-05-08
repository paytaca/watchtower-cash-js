const Watchtower = require('../../../src')

const watchtower = new Watchtower()

const data = {
  sender: {
    address: 'simpleledger:qqz95enwd6qdcy5wnf05hp590sjjknwfuq8sjhpv6x',
    wif: 'XXX' // <-- private key of the sender address
  },
  recipients: [
    {
      address: "simpleledger:qr86pte8hwcljn5cyq3mj7v8s7lvs2p4muddzescf6",
      amount: 10
    }
  ],
  tokenId: "d3e5fbd9e4a6f76e6f91dc5ce878a87e315da409964db21e77dd42f2d2eb2ef6",
  feeFunder: {
    address: 'bitcoincash:qq46tffgznfew8e78dkyt56k9xcmetnelcma256km7',
    wif: 'YYY' // <-- private key of the feeFunder address
  },
  changeAddresses: {
    bch: 'bitcoincash:qq46tffgznfew8e78dkyt56k9xcmetnelcma256km7',
    slp: "simpleledger:qr86pte8hwcljn5cyq3mj7v8s7lvs2p4muddzescf6"
  },
  broadcast: false,
  burn: true // <-- true = burn, false = normal send (this param defaults to false)
}

watchtower.SLP.Type1.send(data).then(function (result) {
  console.log(result)
})
