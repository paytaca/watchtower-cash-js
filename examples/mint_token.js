const Watchtower = require('../src')
const watchtower = new Watchtower()

const data = {
  minter: {
    address: 'simpleledger:qqz95enwd6qdcy5wnf05hp590sjjknwfuq8sjhpv6x',
    wif: 'XXX'  // <-- private key of the sender address
  },
  feeFunder: {
    address: 'bitcoincash:qq46tffgznfew8e78dkyt56k9xcmetnelcma256km7',
    wif: 'YYY' // <-- private key of the feeFunder address
  },
  tokenId: '7f8889682d57369ed0e32336f8b7e0ffec625a35cca183f4e81fde4e71a538a1', // <-- token ID of SLP token you want to mint
  additionalMintRecipient: 'simpleledger:qr86pte8hwcljn5cyq3mj7v8s7lvs2p4muddzescf6', // <-- SLP address recipient of minted tokens
  mintBatonRecipient: 'simpleledger:qrx30gydrlpt2nqc7zrnh74n3ft4dkd8duq9xy6tyk', // <-- (optional) SLP address recipient of minting baton. supply this parameter if passMintingBaton = true
  quantity: 20, // <-- amount of token you want to mint
  broadcast: false,
  passMintingBaton: false // <-- set this to true if you want to mint more tokens in the future (true by default)
}

watchtower.SLP.Type1.mint(data).then(res => {
  console.log(res)
}).catch(err => {
  console.log(err)
})
