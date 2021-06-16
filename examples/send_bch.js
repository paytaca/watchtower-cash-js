const Watchtower = require('../src')

const watchtower = new Watchtower()

const data = {
  sender: {
    address: 'bitcoincash:qp6ls99pxdfsvue4jqhla0esjjm7h685xu5q03v058',
    wif: 'XXX'  // <-- private key of the sender address
  },
  amount: 222,
  recipient: 'simpleledger:qqlgs6e0gnnae5utxvf70degnk6s9xmjt5ljpk673h'
}

watchtower.BCH.send(data).then(function (result) {
  console.log(result)
})
