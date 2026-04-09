const Watchtower = require('../../src')
const sha256 = require('js-sha256')
const { mnemonicToSeedSync } = require('bip39')
const { deriveHdPrivateNodeFromSeed, deriveHdPath, secp256k1, hash160, encodeCashAddress, CashAddressType, CashAddressNetworkPrefix } = require('@bitauth/libauth')

function getWalletHash (mnemonic, derivationPath) {
  const mnemonicHash = sha256(mnemonic)
  const pathHash = sha256(derivationPath)
  const walletHash = sha256(mnemonicHash + pathHash)
  return walletHash
}

function getAddress (mnemonic, derivationPath, index) {
  const seedBuffer = mnemonicToSeedSync(mnemonic)
  const masterHDNode = deriveHdPrivateNodeFromSeed(seedBuffer)
  if (typeof masterHDNode === 'string') throw new Error(masterHDNode)
  const childNode = deriveHdPath(masterHDNode, derivationPath + '/' + index)
  if (typeof childNode === 'string') throw new Error(childNode)
  const publicKeyCompressed = secp256k1.derivePublicKeyCompressed(childNode.privateKey)
  if (typeof publicKeyCompressed === 'string') throw new Error(publicKeyCompressed)
  const pubKeyHash = hash160(publicKeyCompressed)
  return encodeCashAddress({
    prefix: CashAddressNetworkPrefix.mainnet,
    type: CashAddressType.p2pkh,
    payload: pubKeyHash
  }).address
}

const mnemonic = 'the quick brown fox jumps over the lazy dog' // Replace with actual mnemonic
const derivationPath = "m/44'/145'/0'"
const walletHash = getWalletHash(mnemonic, derivationPath)

const projectId = '643da925-bfd4-49da-930d-9d808a7c46fe' // Replace with project ID obtained from Watchtower.cash

async function execute () {
  const walletIndex = 0
  const address = getAddress(mnemonic, derivationPath, walletIndex)
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
    sender: {
      walletHash: walletHash,
      mnemonic: mnemonic,
      derivationPath: derivationPath
    },
    recipients: [
      {
        address: 'bitcoincash:qpj6d5d6rk4da08pad8lx4swrxlejerfy5v68hz3dj',
        amount: 0.00001
      }
    ],
    changeAddress: '',
    broadcast: false
  }
  
  console.log(data)
  
  watchtower.BCH.send(data).then(function (result) {
    console.log(result)
  })

}

execute()
