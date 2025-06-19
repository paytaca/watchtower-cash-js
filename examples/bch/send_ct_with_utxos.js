import Watchtower from '../../dist/index.js'

const watchtower = new Watchtower()

const wif = "" // <-- private key of the sender address
const senderAddress = "bitcoincash:zrgzfwc8lx2p8pw7hhghxhshenxa49u0vsfaxlv92w"
const token = { 
  tokenId: '8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf',
  amount: 1
}

// Fetch and select the utxos you want to use as inputs
const handle = senderAddress
const cashtokenUtxos = await watchtower.BCH.getCashtokensUtxos(handle, token)
console.log('cashTokenUtxos:', cashtokenUtxos)

const selectedUtxos = cashtokenUtxos.utxos
console.log('selectedUtxos:', selectedUtxos)

const data = {
  sender: {
    wif: wif,
    address: senderAddress
  },
  changeAddress: senderAddress,
  recipients: [{
    address: "bitcoincash:qq0060pts4sa3txcvnqjnws9cs4hq9w8egzf8xdw2z",
    tokenAmount: 2,
  }],
  utxos: selectedUtxos,
  token: token,
  broadcast: false
}

watchtower.BCH.send(data).then(function (result) {
  console.log(result)
})
