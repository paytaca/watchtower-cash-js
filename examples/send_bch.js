const Watchtower = require('../src')

const watchtower = new Watchtower()

const data = {
  sender: {
    address: 'bitcoincash:qp6ls99pxdfsvue4jqhla0esjjm7h685xu5q03v058',
    wif: 'XXX'  // <-- private key of the sender address
  },
  recipients: [
    {
      address: 'bitcoincash:qr2evcvc92y8pqu4n85zu24qanlh9lxsdsm7zff6ka',
      amount: 1
    }
  ],
  broadcast: true
}

watchtower.BCH.send(data).then(function (result) {
  console.log(result)
})
