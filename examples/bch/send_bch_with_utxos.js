import Watchtower from '../../dist/index.js'

const watchtower = new Watchtower()

const wif = "" // <-- private key of the sender address
const senderAddress = "bitcoincash:qrgzfwc8lx2p8pw7hhghxhshenxa49u0vswh4pzr4a"

const handle = senderAddress
const bchUtxos = await watchtower.BCH.getBchUtxos(handle, 0)
console.log('bchUtxos:', bchUtxos)

const selectedUtxos = bchUtxos.utxos
console.log('selectedUtxos:', selectedUtxos)

const data = {
  sender: {
    wif: wif,
    address: senderAddress
  },
  recipients: [
    {
      address: "bitcoincash:qq0060pts4sa3txcvnqjnws9cs4hq9w8egzf8xdw2z",
      amount: 0.00001
    }
  ],
  utxos: selectedUtxos,
  token: null,
  broadcast: true,
  minimizeInputs: false // <= (optional, default: true) If true, minimizes inputs to save on fees. If false, allows input consolidation
}

watchtower.BCH.send(data).then(function (result) {
  console.log(result)
})
