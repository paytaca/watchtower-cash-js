const Watchtower = require('../src')

const watchtower = new Watchtower()

const groupTokenBalData = {
    groupTokenId: 'f019cfa73559836c13e00d70e7105d4d43377bb6a9861595a7b2373a66aa0bc7', // <-- NFT parent token ID
    wallet: 'simpleledger:qpq82xgmau3acnuvypkyj0khks4a6ak7zqj6ffwnh8' // <-- address or wallet hash
}

const mintBatonData = {
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
    // (Optional) <-- set a custom change BCH address (fee funder address by default)
    changeAddress: 'bitcoincash:qp46gzcw0ycxtnngrhp0xddp2qxnyjnepg2qc02eeh',
    // (Optional) <-- Broadcast or just return raw transaction hex
    broadcast: true  // true by default
}

const mintChildData = {
    sender: {
        address: 'simpleledger:qqz95enwd6qdcy5wnf05hp590sjjknwfuq8sjhpv6x',
        wif: 'XXX'  // <-- private key of the sender address
    },
    feeFunder: {
        address: 'bitcoincash:qq46tffgznfew8e78dkyt56k9xcmetnelcma256km7',
        wif: 'YYY' // <-- private key of the feeFunder address
    },
    groupTokenId: 'f019cfa73559836c13e00d70e7105d4d43377bb6a9861595a7b2373a66aa0bc7', // <-- NFT parent token ID
    recipient: 'simpleledger:qpq82xgmau3acnuvypkyj0khks4a6ak7zqj6ffwnh8', // <-- only 1 since every NFT is unique and amount is always 1
    label: 'My Unique NFT Token',
    ticker: 'UNI-NFT', // <-- NFT symbol / abbreviation
    docUrl: 'https://uninft.com', // (Optional) <-- Document URL of token
    // (Optional) <-- set a custom change BCH address (fee funder address by default)
    changeAddress: 'bitcoincash:qp46gzcw0ycxtnngrhp0xddp2qxnyjnepg2qc02eeh',
    // (Optional) <-- Broadcast or just return raw transaction hex
    broadcast: true  // true by default
}


// check Parent Group token balance
watchtower.SLP.NFT1.Parent.getGroupTokenBalance(groupTokenBalData).then(result => {
    if (result.success) {
        console.log(result.balance)
    } else {
        console.log(result.error)
    }
})

watchtower.SLP.NFT1.Parent.generateMintingBatonUtxo(mintBatonData).then(result => {
    console.log('MINT baton UTXO result:')
    if (result.success) {
        // Your logic here when send transaction is successful
        console.log(result.txid)

        // or if broadcast is set to false, you can just get the raw transaction hex
        console.log(result.transaction)
        
        watchtower.SLP.NFT1.Parent.mintChildNft(mintChildData).then(result => {
            console.log('MINT Child NFT result')

            if (result.success) {
                // Your logic here when send transaction is successful
                console.log(result.txid)

                // or if broadcast is set to false, you can just get the raw transaction hex
                console.log(result.transaction)
            } else {
                // logic when it fails
                console.log(result.error)
            }
        })
    } else {
        console.log(result.error)
    }
})
