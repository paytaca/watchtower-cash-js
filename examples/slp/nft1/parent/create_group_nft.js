const Watchtower = require('../../../../src')
const watchtower = new Watchtower()

const data = {
  creator: {
    address: 'bitcoincash:qq46tffgznfew8e78dkyt56k9xcmetnelcma256km7',
    wif: 'XXX'  // <-- private key of the sender address
  },
  initialMintRecipient: 'simpleledger:qr86pte8hwcljn5cyq3mj7v8s7lvs2p4muddzescf6', // <-- SLP address recipient for initial minted tokens (if initialQty !== 0)
  mintBatonRecipient: 'simpleledger:qr86pte8hwcljn5cyq3mj7v8s7lvs2p4muddzescf6', // <-- (optional) SLP address recipient for minting baton used to mint tokens in the future, supply this parameter if fixedSupply = false
  name: 'Test Token NFT',
  ticker: 'TEST-NFT',
  initialQty: 1000,
  broadcast: false,
  fixedSupply: true // <-- set true if you dont want any minting in the future (defaults to false)
}

watchtower.SLP.NFT1.Parent.create(data).then(res => {
  console.log(res)
}).catch(err => {
  console.log(err)
})
