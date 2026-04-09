import Address from "./index.js";

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
