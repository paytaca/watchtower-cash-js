const Watchtower = require('../src')

const watchtower = new Watchtower()

const data = {
  sender: 'abcd0123456',
  recipients: [
    {
      address: 'bitcoincash:qr2evcvc92y8pqu4n85zu24qanlh9lxsdsm7zff6ka',
      amount: 0.00001
    }
  ],
  wallet: {
    mnemonic: 'the quick brown fox jumps over the lazy dog',
    derivationPath: "m/44'/0'/0'"
  },
  broadcast: true
}

watchtower.BCH.send(data).then(function (result) {
  console.log(result)
})
