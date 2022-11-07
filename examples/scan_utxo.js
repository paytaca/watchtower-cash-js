const Watchtower = require('../src')

const watchtower = new Watchtower()

const walletHash = '54c7a22cd608b41a4dae441e98d12337b7666f2c0cb6da95e4df3ce7affa467a'
watchtower.Wallet.scanUtxo(walletHash).then(function (result) {
  console.log(result)
})
