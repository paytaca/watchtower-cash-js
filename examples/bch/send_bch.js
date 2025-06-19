import Watchtower from '../../dist/index.js'

const watchtower = new Watchtower()

const data = {
  sender: {
    wif: '', // <-- private key of the sender address
    address: 'bitcoincash:qrgzfwc8lx2p8pw7hhghxhshenxa49u0vswh4pzr4a'
  },
  recipients: [
    {
      address: "bitcoincash:qq0060pts4sa3txcvnqjnws9cs4hq9w8egzf8xdw2z",
      amount: 0.00001,
      tokenAmount: undefined
    }
  ],
  changeAddress: 'bitcoincash:qrgzfwc8lx2p8pw7hhghxhshenxa49u0vswh4pzr4a',
  token: null,
  broadcast: true
}

watchtower.BCH.send(data).then(function (result) {
  console.log(result)
})
