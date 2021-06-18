const Watchtower = require('../src')

const watchtower = new Watchtower()

const data = {
    address: 'simpleledger:qqz95enwd6qdcy5wnf05hp590sjjknwfuq8sjhpv6x',
    projectId: '0000-0000-0000',  // <-- Generate this ID by creating a project at Watchtower.cash
    walletHash: 'abcd0123456', // <-- (Optional) You generate this to track which HD wallet the address belongs to
    webhookCallbackUrl: 'https://xxx.com/webhook-call-receiver'  // <-- (Optional) Your webhook receiver URL
}

watchtower.subscribe(data).then(function (result) {
    if (result.success) {
        // Your logic here when subscription is successful
        console.log(result)
    } else {
        // Your logic here when subscription fails
        console.log(result)
    }
})
