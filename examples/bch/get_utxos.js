import Watchtower from '../../dist/index.js'

const watchtower = new Watchtower()
const address = "bitcoincash:qrgzfwc8lx2p8pw7hhghxhshenxa49u0vswh4pzr4a"

watchtower.BCH.getBchUtxos(address, 0).then(function (result) {
  console.log(result)
})
