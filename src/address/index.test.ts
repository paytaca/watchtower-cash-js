import Address from "./index.js";

test('Test Address.fromXpub', () => {
  // xpub for m/44'/145'/0' derived from mnemonic:
  // "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
  const xpub = 'xpub6ByHsPNSQXTWZ7PLESMY2FufyYWtLXagSUpMQq7Un96SiThZH2iJB1X7pwviH1WtKVeDP6K8d6xxFzzoaFzF3s8BKCZx8oEDdDkNnp4owAZ'

  const result0 = Address.fromXpub(xpub, 0)
  expect(result0.receiving).toBe('bitcoincash:qqyx49mu0kkn9ftfj6hje6g2wfer34yfnq5tahq3q6')
  expect(result0.change).toBe('bitcoincash:qr8aeharupyrmhfu0d4tdmsnc5y8cfk47y6qrsjsrx')

  const result1 = Address.fromXpub(xpub, 1)
  expect(result1.receiving).toBe('bitcoincash:qp8sfdhgjlq68hlzka9lcsxtcnvuvnd0xqxugfzzc5')
  expect(result1.change).toBe('bitcoincash:qr88m3rp5nd5aerz5rh9lzly9u5pevykagwscmjk0c')

  // chipnet
  const chipnetResult = Address.fromXpub(xpub, 0, true)
  expect(chipnetResult.receiving).toBe('bchtest:qqyx49mu0kkn9ftfj6hje6g2wfer34yfnqseeszx8x')
  expect(chipnetResult.change).toBe('bchtest:qr8aeharupyrmhfu0d4tdmsnc5y8cfk47y7j8hs8y6')

  // invalid xpub
  expect(() => Address.fromXpub('invalid-xpub')).toThrow()

  // negative addressIndex
  expect(() => Address.fromXpub(xpub, -1)).toThrow('addressIndex must be non-negative')
})

test('Test Address', () => {
  const address = new Address("bitcoincash:qqs7szj7r600ykzfpjs6xl8dj2u06as43qky0luk4s");
  expect(address.toCashAddress()).toBe("bitcoincash:qqs7szj7r600ykzfpjs6xl8dj2u06as43qky0luk4s");
  expect(address.isCashAddress()).toBe(true);
  expect(address.isLegacyAddress()).toBe(false);
  expect(address.isMainnetCashAddress()).toBe(true);
  expect(address.isTestnetCashAddress()).toBe(false);
  expect(address.isValidBCHAddress()).toBe(true);
  expect(address.toTokenAddress()).toBe("bitcoincash:zqs7szj7r600ykzfpjs6xl8dj2u06as43q3wupjs2r");

  const tokenAddr = new Address(address.toTokenAddress());
  expect(tokenAddr.toCashAddress()).toBe("bitcoincash:qqs7szj7r600ykzfpjs6xl8dj2u06as43qky0luk4s");
  expect(tokenAddr.isCashAddress()).toBe(true);
  expect(tokenAddr.isLegacyAddress()).toBe(false);
  expect(tokenAddr.isMainnetCashAddress()).toBe(true);
  expect(tokenAddr.isTestnetCashAddress()).toBe(false);
  expect(tokenAddr.isValidBCHAddress()).toBe(true);
  expect(tokenAddr.toTokenAddress()).toBe("bitcoincash:zqs7szj7r600ykzfpjs6xl8dj2u06as43q3wupjs2r");

  const testnetAddress = new Address("bchtest:qqs7szj7r600ykzfpjs6xl8dj2u06as43qjktc7pjv");
  expect(testnetAddress.toCashAddress()).toBe("bchtest:qqs7szj7r600ykzfpjs6xl8dj2u06as43qjktc7pjv");
  expect(testnetAddress.isCashAddress()).toBe(true);
  expect(testnetAddress.isLegacyAddress()).toBe(false);
  expect(testnetAddress.isMainnetCashAddress()).toBe(false);
  expect(testnetAddress.isTestnetCashAddress()).toBe(true);
  expect(testnetAddress.isValidBCHAddress()).toBe(true);
  expect(testnetAddress.toTokenAddress()).toBe("bchtest:zqs7szj7r600ykzfpjs6xl8dj2u06as43q4ucxs8dl");

  const testnetTokenAddr = new Address(testnetAddress.toTokenAddress());
  expect(testnetTokenAddr.toCashAddress()).toBe("bchtest:qqs7szj7r600ykzfpjs6xl8dj2u06as43qjktc7pjv");
  expect(testnetTokenAddr.isCashAddress()).toBe(true);
  expect(testnetTokenAddr.isLegacyAddress()).toBe(false);
  expect(testnetTokenAddr.isMainnetCashAddress()).toBe(false);
  expect(testnetTokenAddr.isTestnetCashAddress()).toBe(true);
  expect(testnetTokenAddr.isValidBCHAddress()).toBe(true);
  expect(testnetTokenAddr.toTokenAddress()).toBe("bchtest:zqs7szj7r600ykzfpjs6xl8dj2u06as43q4ucxs8dl");
})
