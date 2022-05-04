const Watchtower = require('../src')

const watchtower = new Watchtower()

const data = {
  sender: {
    address: 'simpleledger:qzwu2vrwcaf9mjhe4p4wl50s0x5cx46nxc02qg92a9',
    wif: 'XXX' // <-- sender wif
  },
  feeFunder: {
    address: 'bitcoincash:qp0wsj9va2srz6vhr6555e2jglm2y3q97vy4eks3gt',
    wif: 'YYY' // <--- fee funder wif
  },
  childTokenId: '5c9aec029dcdea655622fcccfd279b2bc5e300c959f7009dc3c8c20a6905b8fd', // <-- child NFT token id to be sent
  recipient: 'simpleledger:qzstfxd0s849y0gym65mqutvtkdurn77tvgjk27537',
  // (Optional) <-- set a custom change BCH address (fee funder address by default)
  changeAddress: 'bitcoincash:qp46gzcw0ycxtnngrhp0xddp2qxnyjnepg2qc02eeh',
  // (Optional) <-- Broadcast or just return raw transaction hex
  broadcast: true  // true by default
}

watchtower.SLP.NFT1.Child.send(data).then(result => {
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
