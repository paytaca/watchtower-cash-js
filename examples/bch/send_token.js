import Watchtower from '../../dist/index.js'

const watchtower = new Watchtower()

const wif = "" // <-- private key of the sender address

const data = {
  sender: {
    address: "bitcoincash:zrgzfwc8lx2p8pw7hhghxhshenxa49u0vsfaxlv92w",
    wif: wif
  },
  token: {
    tokenId: "8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf",
  },
  recipients: [
    {
      address: "bitcoincash:qq0060pts4sa3txcvnqjnws9cs4hq9w8egzf8xdw2z",
      tokenAmount: 3
    }
  ],
  changeAddress: "bitcoincash:zrgzfwc8lx2p8pw7hhghxhshenxa49u0vsfaxlv92w",
  broadcast: true
}

watchtower.BCH.send(data).then(function (result) {
  console.log(result)
})
