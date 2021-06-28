const Watchtower = require('../src')

const watchtower = new Watchtower()


function getPrivateKey (walletHash, walletIndex) {
  // Logic here for retrieveing private key from a wallet
  // given wallet hash and wallet index
  return 'XXX'
}

const data = {
  sender: 'abcd0123456',
  recipients: [
    {
      address: 'bitcoincash:qr2evcvc92y8pqu4n85zu24qanlh9lxsdsm7zff6ka',
      amount: 0.00001
    }
  ],
  retrieveKeyFunction: getPrivateKey,
  broadcast: true
}

watchtower.BCH.send(data).then(function (result) {
  console.log(result)
})
