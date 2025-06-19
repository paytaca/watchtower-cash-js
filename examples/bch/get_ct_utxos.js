import Watchtower from '../../dist/index.js'

const watchtower = new Watchtower()
const address = "bitcoincash:zrgzfwc8lx2p8pw7hhghxhshenxa49u0vsfaxlv92w"
const token = { 
  tokenId: '8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf',
  amount: 10
}
const ops = {
  filterByMinValue: true // <= return all UTXOs above amount 
}

watchtower.BCH.getCashtokensUtxos(address, token, ops).then(function (result) {
  console.log(result)
})
