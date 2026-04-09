import Address from "./index.js";

test('Test Address', () => {
  const address = new Address("bitcoincash:qqs7szj7r600ykzfpjs6xl8dj2u06as43qky0luk4s");
  expect(address.toCashAddress()).toBe("bitcoincash:qqs7szj7r600ykzfpjs6xl8dj2u06as43qky0luk4s");
  expect(address.isCashAddress()).toBe(true);
  expect(address.isLegacyAddress()).toBe(false);
  expect(address.isMainnetCashAddress()).toBe(true);
  expect(address.isMainnetSLPAddress()).toBe(false);
  expect(address.isSLPAddress()).toBe(false);
  expect(address.isTestnetCashAddress()).toBe(false);
  expect(address.isTestnetSLPAddress()).toBe(false);
  expect(address.isValidBCHAddress()).toBe(true);
  expect(address.isValidSLPAddress()).toBe(false);
  expect(address.toSLPAddress()).toBe("simpleledger:qqs7szj7r600ykzfpjs6xl8dj2u06as43q6lyyfktw");
  expect(address.toTokenAddress()).toBe("bitcoincash:zqs7szj7r600ykzfpjs6xl8dj2u06as43q3wupjs2r");

  const slpAddr = new Address(address.toSLPAddress());
  expect(slpAddr.toCashAddress()).toBe("bitcoincash:qqs7szj7r600ykzfpjs6xl8dj2u06as43qky0luk4s");
  expect(slpAddr.isCashAddress()).toBe(true);
  expect(slpAddr.isLegacyAddress()).toBe(false);
  expect(slpAddr.isMainnetCashAddress()).toBe(false);
  expect(slpAddr.isMainnetSLPAddress()).toBe(true);
  expect(slpAddr.isSLPAddress()).toBe(true);
  expect(slpAddr.isTestnetCashAddress()).toBe(false);
  expect(slpAddr.isTestnetSLPAddress()).toBe(false);
  expect(slpAddr.isValidBCHAddress()).toBe(true);
  expect(slpAddr.isValidSLPAddress()).toBe(true);
  expect(slpAddr.toSLPAddress()).toBe("simpleledger:qqs7szj7r600ykzfpjs6xl8dj2u06as43q6lyyfktw");
  expect(slpAddr.toTokenAddress()).toBe("bitcoincash:zqs7szj7r600ykzfpjs6xl8dj2u06as43q3wupjs2r");

  const tokenAddr = new Address(address.toTokenAddress());
  expect(tokenAddr.toCashAddress()).toBe("bitcoincash:qqs7szj7r600ykzfpjs6xl8dj2u06as43qky0luk4s");
  expect(tokenAddr.isCashAddress()).toBe(true);
  expect(tokenAddr.isLegacyAddress()).toBe(false);
  expect(tokenAddr.isMainnetCashAddress()).toBe(true);
  expect(tokenAddr.isMainnetSLPAddress()).toBe(false);
  expect(tokenAddr.isSLPAddress()).toBe(false);
  expect(tokenAddr.isTestnetCashAddress()).toBe(false);
  expect(tokenAddr.isTestnetSLPAddress()).toBe(false);
  expect(tokenAddr.isValidBCHAddress()).toBe(true);
  expect(tokenAddr.isValidSLPAddress()).toBe(false);
  expect(tokenAddr.toSLPAddress()).toBe("simpleledger:qqs7szj7r600ykzfpjs6xl8dj2u06as43q6lyyfktw");
  expect(tokenAddr.toTokenAddress()).toBe("bitcoincash:zqs7szj7r600ykzfpjs6xl8dj2u06as43q3wupjs2r");


  const testnetAddress = new Address("bchtest:qqs7szj7r600ykzfpjs6xl8dj2u06as43qjktc7pjv");
  expect(testnetAddress.toCashAddress()).toBe("bchtest:qqs7szj7r600ykzfpjs6xl8dj2u06as43qjktc7pjv");
  expect(testnetAddress.isCashAddress()).toBe(true);
  expect(testnetAddress.isLegacyAddress()).toBe(false);
  expect(testnetAddress.isMainnetCashAddress()).toBe(false);
  expect(testnetAddress.isMainnetSLPAddress()).toBe(false);
  expect(testnetAddress.isSLPAddress()).toBe(false);
  expect(testnetAddress.isTestnetCashAddress()).toBe(true);
  expect(testnetAddress.isTestnetSLPAddress()).toBe(false);
  expect(testnetAddress.isValidBCHAddress()).toBe(true);
  expect(testnetAddress.isValidSLPAddress()).toBe(false);
  expect(testnetAddress.toSLPAddress()).toBe("slptest:qqs7szj7r600ykzfpjs6xl8dj2u06as43qfzvrykq3");
  expect(testnetAddress.toTokenAddress()).toBe("bchtest:zqs7szj7r600ykzfpjs6xl8dj2u06as43q4ucxs8dl");

  const testnetSlpAddr = new Address(testnetAddress.toSLPAddress());
  expect(testnetSlpAddr.toCashAddress()).toBe("bchtest:qqs7szj7r600ykzfpjs6xl8dj2u06as43qjktc7pjv");
  expect(testnetSlpAddr.isCashAddress()).toBe(true);
  expect(testnetSlpAddr.isLegacyAddress()).toBe(false);
  expect(testnetSlpAddr.isMainnetCashAddress()).toBe(false);
  expect(testnetSlpAddr.isMainnetSLPAddress()).toBe(false);
  expect(testnetSlpAddr.isSLPAddress()).toBe(true);
  expect(testnetSlpAddr.isTestnetCashAddress()).toBe(false);
  expect(testnetSlpAddr.isTestnetSLPAddress()).toBe(true);
  expect(testnetSlpAddr.isValidBCHAddress()).toBe(true);
  expect(testnetSlpAddr.isValidSLPAddress()).toBe(true);
  expect(testnetSlpAddr.toSLPAddress()).toBe("slptest:qqs7szj7r600ykzfpjs6xl8dj2u06as43qfzvrykq3");
  expect(testnetSlpAddr.toTokenAddress()).toBe("bchtest:zqs7szj7r600ykzfpjs6xl8dj2u06as43q4ucxs8dl");

  const testnetTokenAddr = new Address(testnetAddress.toTokenAddress());
  expect(testnetTokenAddr.toCashAddress()).toBe("bchtest:qqs7szj7r600ykzfpjs6xl8dj2u06as43qjktc7pjv");
  expect(testnetTokenAddr.isCashAddress()).toBe(true);
  expect(testnetTokenAddr.isLegacyAddress()).toBe(false);
  expect(testnetTokenAddr.isMainnetCashAddress()).toBe(false);
  expect(testnetTokenAddr.isMainnetSLPAddress()).toBe(false);
  expect(testnetTokenAddr.isSLPAddress()).toBe(false);
  expect(testnetTokenAddr.isTestnetCashAddress()).toBe(true);
  expect(testnetTokenAddr.isTestnetSLPAddress()).toBe(false);
  expect(testnetTokenAddr.isValidBCHAddress()).toBe(true);
  expect(testnetTokenAddr.isValidSLPAddress()).toBe(false);
  expect(testnetTokenAddr.toSLPAddress()).toBe("slptest:qqs7szj7r600ykzfpjs6xl8dj2u06as43qfzvrykq3");
  expect(testnetTokenAddr.toTokenAddress()).toBe("bchtest:zqs7szj7r600ykzfpjs6xl8dj2u06as43q4ucxs8dl");
})