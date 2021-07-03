const Watchtower = require('../src')
const sha256 = require('js-sha256')
const BCHJS = require('@psf/bch-js')

const bchjs = new BCHJS()

function getWalletHash (mnemonic, derivationPath) {
  const mnemonicHash = sha256(mnemonic)
  const pathHash = sha256(derivationPath)
  const walletHash = sha256(mnemonicHash + pathHash)
  return walletHash
}

async function _getChildNode (mnemonic, derivationPath, index) {
  const seedBuffer = await bchjs.Mnemonic.toSeed(mnemonic)
  const masterHDNode = bchjs.HDNode.fromSeed(seedBuffer)
  const childNode = masterHDNode.derivePath(derivationPath + '/' + index)
  return childNode
}

async function getAddress (mnemonic, derivationPath, index) {
  const childNode = await _getChildNode(mnemonic, derivationPath, index)
  const address = bchjs.HDNode.toCashAddress(childNode)
  return address
}

const mnemonic = 'the quick brown fox jumps over the lazy dog' // Replace with actual mnemonic
const derivationPath = "m/44'/145'/0'"
const walletHash = getWalletHash(mnemonic, derivationPath)

const projectId = '643da925-bfd4-49da-930d-9d808a7c46fe' // Replace with project ID obtained from Watchtower.cash

async function execute () {
  const walletIndex = 0
  const address = await getAddress(mnemonic, derivationPath, walletIndex)
  console.log('Wallet hash:', walletHash)
  console.log('Address:', address)

  // Initialize watchtower
  const watchtower = new Watchtower()

  // Subscribe
  const subscribeData = {
      address: address,
      projectId: projectId,
      walletHash: walletHash,
      walletIndex: walletIndex
  }
  watchtower.subscribe(subscribeData).then(function (result) {
    console.log(result)
  })

  // Get balance
  watchtower.Wallet.getBalance({ walletHash }).then(function (balance) {
    console.log(balance)
  })

  // Get history
  watchtower.Wallet.getHistory({ walletHash }).then(function (history) {
    console.log(history)
  })

  // Send
  const data = {
      sender: walletHash,
      recipients: [
        {
          address: 'bitcoincash:qpj6d5d6rk4da08pad8lx4swrxlejerfy5v68hz3dj',
          amount: 0.00001
        }
      ],
      wallet: {
        mnemonic: mnemonic,
        derivationPath: derivationPath
      },
      broadcast: false
    }
    
    console.log(data)
    
    watchtower.BCH.send(data).then(function (result) {
      console.log(result)
    })

}

execute()
