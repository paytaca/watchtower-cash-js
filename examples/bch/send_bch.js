import Watchtower from '../../dist/index.js'

const watchtower = new Watchtower()

const data = {
  sender: {
    address: 'bitcoincash:qrwvvjuer2zartus2x4rqtujh6ydh0v75cue6kflwy',
    wif: ''  // <-- private key of the sender address
  },
  recipients: [
    {
      address: 'bitcoincash:qqm0mff5klkt697tzuqt73dywl742tv7hqhxkckazg',
      amount: 0.001
    }
  ],
  broadcast: true
}

watchtower.BCH.send(data).then(function (result) {
  console.log(result)
})
