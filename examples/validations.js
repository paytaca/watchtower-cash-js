const Address = require('../src/address')

const valid = new Address('bchtest:qqwkk2rg5grcuvgsfkw2a4546n7nmypsgymknfcc03').isValidBCHAddress(true)
console.log(valid)
