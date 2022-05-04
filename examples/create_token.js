const Watchtower = require('../src')
const watchtower = new Watchtower()

const data = {
  creator: {
    address: 'simpleledger:qqz95enwd6qdcy5wnf05hp590sjjknwfuq8sjhpv6x',
    wif: 'XXX'  // <-- private key of the sender address
  },
  initialMintRecipient: 'simpleledger:qr86pte8hwcljn5cyq3mj7v8s7lvs2p4muddzescf6', // <-- SLP address recipient for initial minted tokens (if initialQty !== 0)
  mintBatonRecipient: 'simpleledger:qr86pte8hwcljn5cyq3mj7v8s7lvs2p4muddzescf6', // <-- (optional) SLP address recipient for minting baton used to mint tokens in the future, supply this parameter if fixedSupply = false
  name: 'Jet Token',
  ticker: 'JET',
  decimals: 8,
  initialQty: 10,
  broadcast: false,
  fixedSupply: false // <-- set true if you dont want any minting in the future (defaults to false)
}

watchtower.SLP.Type1.create(data).then(res => {
  console.log(res)
}).catch(err => {
  console.log(err)
})
