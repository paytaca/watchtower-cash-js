import Watchtower from '../../dist/index.js'

const watchtower = new Watchtower()
const address = "bitcoincash:qrgzfwc8lx2p8pw7hhghxhshenxa49u0vswh4pzr4a"
const value = 0.00001
const ops = {
  // filterByMinValue: true // <= return all UTXOs above value 
}

watchtower.BCH.getBchUtxos(address, value, ops).then(function (result) {
  console.log(result)
})
