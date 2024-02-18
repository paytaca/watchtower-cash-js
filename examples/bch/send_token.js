import Watchtower from '../../dist/index.js'

const watchtower = new Watchtower()

const data = {
  sender: {
    address: 'bitcoincash:zrwvvjuer2zartus2x4rqtujh6ydh0v75cmnfg8e3h',
    wif: ''  // <-- private key of the sender address
  },
  token: {
    tokenId: 'de980d12e49999f1dbc8d61a8f119328f7be9fb1c308eafe979bf10abb17200d',
  },
  recipients: [
    {
      address: 'bitcoincash:zqm0mff5klkt697tzuqt73dywl742tv7hqsv9xcmam',
      tokenAmount: 5
    }
  ],
  changeAddress: 'bitcoincash:zqm0mff5klkt697tzuqt73dywl742tv7hqsv9xcmam',
  broadcast: false
}

watchtower.BCH.send(data).then(function (result) {
  console.log(result)
})
