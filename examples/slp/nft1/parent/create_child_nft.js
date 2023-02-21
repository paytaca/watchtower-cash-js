const Watchtower = require('../../../../src')

const watchtower = new Watchtower()

const createChildNftData = {
  sender: {
    address: 'simpleledger:qp3et5cla7jju6z2lfc5v9nr0r4q54edqqdl5mxfjc',
    wif: 'XXX'  // <-- private key of the sender address
  },
  feeFunder: {
    address: 'bitcoincash:qp0wsj9va2srz6vhr6555e2jglm2y3q97vy4eks3gt',
    wif: 'YYY' // <-- private key of the feeFunder address
  },
  groupTokenId: 'f019cfa73559836c13e00d70e7105d4d43377bb6a9861595a7b2373a66aa0bc7', // <-- NFT parent token ID
  recipient: 'simpleledger:qp3et5cla7jju6z2lfc5v9nr0r4q54edqqdl5mxfjc', // <-- only 1 since every NFT is unique and amount is always 1
  label: 'My Unique NFT Token',
  ticker: 'UNI-NFT', // <-- NFT symbol / abbreviation
  docUrl: 'https://uninft.com', // (Optional) <-- Document URL of token
  // (Optional) <-- set a custom change BCH address (fee funder address by default)
  changeAddress: 'bitcoincash:qp46gzcw0ycxtnngrhp0xddp2qxnyjnepg2qc02eeh',
  // (Optional) <-- Broadcast or just return raw transaction hex
  broadcast: true  // true by default
}

const findMintingBatonData = {
  groupTokenId: createChildNftData.groupTokenId,
  address: createChildNftData.sender.address
}

const mintBatonData = {
  sender: {
    address: createChildNftData.sender.address,
    wif: createChildNftData.sender.wif  // <-- private key of the sender address
  },
  feeFunder: {
    address: createChildNftData.feeFunder.address,
    wif: createChildNftData.feeFunder.wif // <-- private key of the feeFunder address
  },
  groupTokenId: createChildNftData.groupTokenId, // <-- NFT parent token ID
  recipient: createChildNftData.sender.address, // <-- only 1 since every NFT is unique and amount is always 1
  // (Optional) <-- set a custom change BCH address (fee funder address by default)
  changeAddress: createChildNftData.changeAddress,
  // (Optional) <-- Broadcast or just return raw transaction hex
  broadcast: true  // true by default
}


watchtower.SLP.NFT1.Parent.findChildNftMintingBaton(findMintingBatonData)
  .then(async (mintingUtxo) => {
    if (!mintingUtxo) {
      console.log('Creating minting baton')
      const mintingBatonResult = await watchtower.SLP.NFT1.Parent.generateMintingBatonUtxo(mintBatonData)
      console.log('Created minting baton:', mintingBatonResult)
    } else {
      console.log('Found minting baton:', mintingUtxo)
    }

    console.log('Creating child nft')
    watchtower.SLP.NFT1.Parent.createChildNft(createChildNftData)
      .then(console.log)
      .catch(console.error)
  })
  .catch(console.error)
