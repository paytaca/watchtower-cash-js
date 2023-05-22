import { decodeTransaction as _decodeTransaction, binToHex, hexToBin, lockingBytecodeToCashAddress } from "@bitauth/libauth";
import { BCH, SendRequest } from "../bch";
import { setupAxiosMock } from "../test/axios";
import { OpReturnData } from "mainnet-js"
import { Wallet } from "../wallet";

const decodeTransaction = (txHex: string) => {
  const transaction = _decodeTransaction(hexToBin(txHex));
  if (typeof transaction === "string") {
    throw transaction;
  }

  return {
    locktime: transaction.locktime,
    version: transaction.version,
    inputs: transaction.inputs.map(val => ({
      txid: binToHex(val.outpointTransactionHash),
      vout: val.outpointIndex,
      sequenceNumber: val.sequenceNumber,
      unlockingBytecode: val.unlockingBytecode
      })),
    outputs: transaction.outputs.map(val => ({
      data: val.lockingBytecode[0] === 0x6a ? OpReturnData.parse(binToHex(val.lockingBytecode)) : undefined,
      address: val.lockingBytecode[0] === 0x6a ? undefined : lockingBytecodeToCashAddress(val.lockingBytecode, "bchtest") as string,
      satoshis: Number(val.valueSatoshis),
      token: val.token ? {
        amount: val.token.amount,
        tokenId: binToHex(val.token.category),
        commitment: val.token?.nft?.commitment ? binToHex(val.token?.nft?.commitment) : undefined,
        capability: val.token?.nft?.capability
      } : undefined
    }))};
}

const sendRequest = {
  sender: {
      walletHash: "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32",
      mnemonic: "excuse mother slide subject desert ability dad slab observe mandate tiger code",
      derivationPath: "m/44'/145'/0'"
  },
  recipients: [
      {
          address: "bchtest:qzy2xp7p0sxpkspgpmgud5y060uw8d5w6y94n2hxxv",
          amount: 0.09994649
      }
  ],
  changeAddress: "bchtest:qqeytp52dh9wxwm7rue92nfm6hqxmpwj5qv6qqfhp8",
  broadcast: false,
  data: undefined,
  feeFunder: undefined
}

const utxosResponse = {
  valid: true,
  wallet: 'f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32',
  utxos: [
    {
      txid: '87ef6aa53c25638103daecb7e0ab347c921033f8b8e60941431e911d9ab7dae2',
      value: 9967874,
      vout: 1,
      block: null,
      wallet_index: null,
      address_path: '0/0'
    },
    {
      txid: '87ef6aa53c25638103daecb7e0ab347c921033f8b8e60941431e911d9ab7dae2',
      value: 10000,
      vout: 0,
      block: null,
      wallet_index: null,
      address_path: '0/0'
    },
    {
      txid: 'c34d9f77e8184b10c731701b9aedfb5242fc08af8b43669e30836ec5412d2518',
      value: 17350,
      vout: 1,
      block: 148865,
      wallet_index: null,
      address_path: '0/0'
    }
  ]
}

const feeFunderUtxosResponse = {
  valid: true,
  wallet: 'b955983e994603dd8a73b2869450e32f77bb0c8b2063ba5cd61e8186c51705ba',
  utxos: [
    {
      txid: '7c921033f8b8e60941431e911d9ab7dae287ef6aa53c25638103daecb7e0ab34',
      value: 400000,
      vout: 1,
      block: null,
      wallet_index: null,
      address_path: '0/0'
    },
  ]
}

const feeFunderTooManyUtxosResponse = {
  valid: true,
  wallet: 'b955983e994603dd8a73b2869450e32f77bb0c8b2063ba5cd61e8186c51705ba',
  utxos: [
    {
      txid: '7c921033f8b8e60941431e911d9ab7dae287ef6aa53c25638103daecb7e0ab34',
      value: 100,
      vout: 1,
      block: null,
      wallet_index: null,
      address_path: '0/0'
    },
    {
      txid: '7c921033f8b8e60941431e911d9ab7dae287ef6aa53c25638103daecb7e0ab34',
      value: 100,
      vout: 1,
      block: null,
      wallet_index: null,
      address_path: '0/0'
    },
    {
      txid: '7c921033f8b8e60941431e911d9ab7dae287ef6aa53c25638103daecb7e0ab34',
      value: 400000,
      vout: 1,
      block: null,
      wallet_index: null,
      address_path: '0/0'
    },
  ]
}

const feeFunderNoUtxosResponse = {
  valid: true,
  wallet: 'b955983e994603dd8a73b2869450e32f77bb0c8b2063ba5cd61e8186c51705ba',
  utxos: []
}

const tokenSendRequest = {
  sender: {
      walletHash: "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32",
      mnemonic: "excuse mother slide subject desert ability dad slab observe mandate tiger code",
      derivationPath: "m/44'/145'/0'"
  },
  recipients: [
      {
          address: "bchtest:qzy2xp7p0sxpkspgpmgud5y060uw8d5w6y94n2hxxv",
          tokenAmount: 5n
      }
  ],
  changeAddress: "bchtest:qqeytp52dh9wxwm7rue92nfm6hqxmpwj5qv6qqfhp8",
  broadcast: false,
  data: undefined,
  feeFunder: undefined,
  token: { tokenId: "9bd5b8f1ca10e4034ddd88d3541474a22c78f6d0ae3e2d54d3dfdbc62b34ac8d" }
}

const tokenNFTSendRequest = {
  sender: {
      walletHash: "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32",
      mnemonic: "excuse mother slide subject desert ability dad slab observe mandate tiger code",
      derivationPath: "m/44'/145'/0'"
  },
  recipients: [
      {
          address: "bchtest:qzy2xp7p0sxpkspgpmgud5y060uw8d5w6y94n2hxxv",
          // tokenAmount: 0n
      }
  ],
  changeAddress: "bchtest:qqeytp52dh9wxwm7rue92nfm6hqxmpwj5qv6qqfhp8",
  broadcast: false,
  data: undefined,
  feeFunder: undefined,
  token: {
    tokenId: "17403493f012fd0916f3cb0c14aa385fccfda7415c4d201b2db2b12428e1ecc7",
    capability: "minting",
    commitment: ""
  }
} as SendRequest

const tokensResponse = {
  valid: true,
  wallet: 'f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32',
  utxos: [
    {
      txid: '3bf095bc551a3bd18ded26f6187cec028eaf207f114df000eff30617e24fb87e',
      amount: 0,
      value: 1000,
      vout: 1,
      capability: 'none',
      commitment: 'beef',
      cashtoken_nft_details: {},
      token_type: null,
      block: 148865,
      tokenid: "17403493f012fd0916f3cb0c14aa385fccfda7415c4d201b2db2b12428e1ecc7",
      token_name: null,
      decimals: null,
      token_ticker: null,
      is_cashtoken: true,
      wallet_index: null,
      address_path: '0/0'
    },
    {
      txid: '3bf095bc551a3bd18ded26f6187cec028eaf207f114df000eff30617e24fb87e',
      amount: 0,
      value: 1000,
      vout: 0,
      capability: 'minting',
      commitment: '',
      cashtoken_nft_details: {},
      token_type: null,
      block: 148865,
      tokenid: "17403493f012fd0916f3cb0c14aa385fccfda7415c4d201b2db2b12428e1ecc7",
      token_name: null,
      decimals: null,
      token_ticker: null,
      is_cashtoken: true,
      wallet_index: null,
      address_path: '0/0'
    },
    {
      txid: 'd45596de09fe1fff61d43c3cc4d8b5d5c1f89a03b37367e534e586b4e7f4d7f1',
      amount: 10,
      value: 1000,
      vout: 0,
      capability: null,
      commitment: null,
      cashtoken_nft_details: null,
      token_type: null,
      block: 148842,
      tokenid: '9bd5b8f1ca10e4034ddd88d3541474a22c78f6d0ae3e2d54d3dfdbc62b34ac8d',
      token_name: '',
      decimals: 0,
      token_ticker: '',
      is_cashtoken: true,
      wallet_index: null,
      address_path: '0/0'
    }
  ]
}

const emptyTokensResponse = {
  valid: true,
  wallet: 'f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32',
  utxos: []
}


describe('plain bch', () => {
  test('test sending bch', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    const result = await bch.send(sendRequest);
    const transaction = decodeTransaction(result.transaction!);
    expect(transaction.inputs.length).toBe(3);
    expect(transaction.outputs.length).toBe(1);
  })

  test('test wif sender', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const handle = "bchtest:qzy2xp7p0sxpkspgpmgud5y060uw8d5w6y94n2hxxv";

    setupAxiosMock(`utxo/bch/${handle}/`, utxosResponse, bch._api);
    const result = await bch.send({...sendRequest, sender: {
      address: "bchtest:qzy2xp7p0sxpkspgpmgud5y060uw8d5w6y94n2hxxv",
      wif: "cPVDKBRg4qgpqUd86KvPU4gyA3YjCYGmuyMrcsSN479WUFS6dy29"
    }});
    const transaction = decodeTransaction(result.transaction!);
    expect(transaction.inputs.length).toBe(3);
    expect(transaction.outputs.length).toBe(1);
  })

  test('test change address not set', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    const result = await bch.send({...sendRequest, changeAddress: undefined });
    const transaction = decodeTransaction(result.transaction!);
    expect(transaction.inputs.length).toBe(3);
    expect(transaction.outputs.length).toBe(1);
  })

  test('test sending bch with change', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    const result = await bch.send({...sendRequest, recipients: [
      {
        address: "bchtest:qzy2xp7p0sxpkspgpmgud5y060uw8d5w6y94n2hxxv",
        amount: 18000 / 1e8
      }
    ]});
    const transaction = decodeTransaction(result.transaction!);

    expect(transaction.inputs.length).toBe(1);
    expect(transaction.outputs.length).toBe(2);
    expect(transaction.outputs[0].satoshis).toBe(18000);
  })

  test('test sending bch with opreturn data', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    const result = await bch.send({...sendRequest, recipients: [
      {
        address: "bchtest:qzy2xp7p0sxpkspgpmgud5y060uw8d5w6y94n2hxxv",
        amount: 18000 / 1e8
      }
    ], data: "hello"});
    const transaction = decodeTransaction(result.transaction!);

    expect(transaction.inputs.length).toBe(1);
    expect(transaction.outputs.length).toBe(3);
    expect(transaction.outputs[0].satoshis).toBe(0);
    expect(transaction.outputs[0].data.length).toBe(1);
    expect(transaction.outputs[0].data[0]).toBe("hello");
  })

  test('test failures', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    {
      const result = await bch.send({...sendRequest, recipients: [
        {
          address: "bchtest:qzy2xp7p0sxpkspgpmgud5y060uw8d5w6y94n2hxxv",
          amount: 1.09994649
        }
      ]});
      expect(result.success).toBe(false);
      expect(result.error).toContain("not enough balance in sender");
      expect(result.error).toContain("to cover the send amount");
    }

    {
      const result = await bch.send({...sendRequest, recipients: [
        {
          address: "bchtest:qzy2xp7p0sxpkspgpmgud5y060uw8d5w6y94n2hxxv",
          amount: 0.09995032
        }
      ]});
      expect(result.success).toBe(false);
      expect(result.error).toContain("not enough balance in sender");
      expect(result.error).toContain("to cover the fee");
    }

    {
      const result = await bch.send({...sendRequest, recipients: [{
        amount: 0.09994649,
        address: "asdf",
      }]});
      expect(result.success).toBe(false);
      expect(result.error).toContain("recipient should have a valid BCH address");
    }
  })
});

describe('feeFunder', () => {
  test('test sending bch, wif funder', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";
    const handle = "bchtest:qrsk8fxge6jhdtxy6v2khy6gxdmcq6mffc0mlfsnmv";
    setupAxiosMock(`utxo/bch/${handle}/`, feeFunderUtxosResponse, bch._api);

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    const result = await bch.send({...sendRequest, recipients: [{
      address: tokenSendRequest.recipients[0].address,
      amount: 50000 / 1e8,
    }], feeFunder: {
      address: "bchtest:qrsk8fxge6jhdtxy6v2khy6gxdmcq6mffc0mlfsnmv",
      wif: "cNaTiGGvkD7Xax9Q3XEbDWmnTAKGPjwYtpz52V94F65S4FgBmAnM"
    }});
    const transaction = decodeTransaction(result.transaction!);
    expect(transaction.inputs.length).toBe(2);
    // 1 for recipient, 1 for change, 1 for funder change
    expect(transaction.outputs.length).toBe(3);
  })

  test('test sending bch, mnemonic funder', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    const feeFunder = {
      walletHash: "b955983e994603dd8a73b2869450e32f77bb0c8b2063ba5cd61e8186c51705ba",
      mnemonic: "code tiger mandate observe slab dad ability desert subject slide mother excuse",
      derivationPath: "m/44'/145'/0'"
    };

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    setupAxiosMock(`utxo/wallet/${feeFunder.walletHash}/`, feeFunderUtxosResponse, bch._api);

    const result = await bch.send({...sendRequest, recipients: [{
      address: tokenSendRequest.recipients[0].address,
      amount: 50000 / 1e8,
    }], feeFunder: feeFunder});
    const transaction = decodeTransaction(result.transaction!);
    expect(transaction.inputs.length).toBe(2);
    // 1 for recipient, 1 for change, 1 for funder change
    expect(transaction.outputs.length).toBe(3);
  })

  test('test sending bch, no funder utxos', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    const feeFunder = {
      walletHash: "b955983e994603dd8a73b2869450e32f77bb0c8b2063ba5cd61e8186c51705ba",
      mnemonic: "code tiger mandate observe slab dad ability desert subject slide mother excuse",
      derivationPath: "m/44'/145'/0'"
    };

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    setupAxiosMock(`utxo/wallet/${feeFunder.walletHash}/`, feeFunderNoUtxosResponse, bch._api);

    const result = await bch.send({...sendRequest, recipients: [{
      address: tokenSendRequest.recipients[0].address,
      amount: 50000 / 1e8,
    }], feeFunder: feeFunder});
    expect(result.success).toBe(false);
    expect(result.error).toContain("not enough balance in fee funder");
  })

  test('test sending bch, too many funder utxos', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    const feeFunder = {
      walletHash: "b955983e994603dd8a73b2869450e32f77bb0c8b2063ba5cd61e8186c51705ba",
      mnemonic: "code tiger mandate observe slab dad ability desert subject slide mother excuse",
      derivationPath: "m/44'/145'/0'"
    };

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    setupAxiosMock(`utxo/wallet/${feeFunder.walletHash}/`, feeFunderTooManyUtxosResponse, bch._api);

    const result = await bch.send({...sendRequest, recipients: [{
      address: tokenSendRequest.recipients[0].address,
      amount: 50000 / 1e8,
    }], feeFunder: feeFunder});
    expect(result.success).toBe(false);
    expect(result.error).toContain("UTXOs of your fee funder are thinly spread out which can cause inaccurate fee computation");
  })

  test('test sending bch, fee funder is sender', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    const result = await bch.send({...sendRequest, feeFunder: sendRequest.sender });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Using `feeFunder` same as `sender` is not supported");
  })
});


describe('tokens', () => {
  test('test sending tokens, no utxos', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    setupAxiosMock(`utxo/wallet/${walletHash}/?is_cashtoken=true`, emptyTokensResponse, bch._api);

    const result = await bch.send(tokenNFTSendRequest);
    expect(result.success).toBe(false);
    expect(result.error).toContain("no suitable utxos were found to spend token");
  })

  test('test sending nft tokens, wif sender', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const handle = "bchtest:qzy2xp7p0sxpkspgpmgud5y060uw8d5w6y94n2hxxv";

    setupAxiosMock(`utxo/bch/${handle}/`, utxosResponse, bch._api);
    setupAxiosMock(`utxo/ct/${handle}/?is_cashtoken=true`, tokensResponse, bch._api);

    const result = await bch.send({...tokenNFTSendRequest, sender: {
      address: "bchtest:qzy2xp7p0sxpkspgpmgud5y060uw8d5w6y94n2hxxv",
      wif: "cPVDKBRg4qgpqUd86KvPU4gyA3YjCYGmuyMrcsSN479WUFS6dy29"
    }});

    expect(result.success).toBe(true);
    const transaction = decodeTransaction(result.transaction!);
    expect(transaction.inputs.length).toBe(2);
    expect(transaction.outputs.length).toBe(2);
    expect(transaction.outputs[0].token.commitment).toBe("");
    expect(transaction.outputs[0].token.capability).toBe("minting");
  })

  test('test sending nft tokens', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    setupAxiosMock(`utxo/wallet/${walletHash}/?is_cashtoken=true`, tokensResponse, bch._api);

    const result = await bch.send(tokenNFTSendRequest);
    expect(result.success).toBe(true);
    const transaction = decodeTransaction(result.transaction!);
    expect(transaction.inputs.length).toBe(2);
    expect(transaction.outputs.length).toBe(2);
    expect(transaction.outputs[0].token.commitment).toBe("");
    expect(transaction.outputs[0].token.capability).toBe("minting");
  })

  test('test sending ft tokens', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    setupAxiosMock(`utxo/wallet/${walletHash}/?is_cashtoken=true`, tokensResponse, bch._api);

    const result = await bch.send(tokenSendRequest);
    expect(result.success).toBe(true);
    const transaction = decodeTransaction(result.transaction!);
    expect(transaction.inputs.length).toBe(2);
    expect(transaction.outputs.length).toBe(3);
  })

  test('test sending ft tokens, not enough', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    setupAxiosMock(`utxo/wallet/${walletHash}/?is_cashtoken=true`, tokensResponse, bch._api);

    const result = await bch.send({...tokenSendRequest, recipients: [{
      address: tokenSendRequest.recipients[0].address,
      tokenAmount: 11n
    }]});
    expect(result.success).toBe(false);
    expect(result.error).toContain("not enough fungible token amount available to send");
  })

  test('test sending ft tokens, 0 amount', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    setupAxiosMock(`utxo/wallet/${walletHash}/?is_cashtoken=true`, tokensResponse, bch._api);

    const result = await bch.send({...tokenSendRequest, recipients: [{
      address: tokenSendRequest.recipients[0].address,
      tokenAmount: 0n
    }]});
    expect(result.success).toBe(false);
    expect(result.error).toContain("can not send 0 fungible tokens");
  })

  test('test sending ft tokens, undefined amount', async () => {
    const bch = new BCH("https://chipnet.watchtower.cash/api/", true);
    const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";

    setupAxiosMock(`utxo/wallet/${walletHash}/`, utxosResponse, bch._api);
    setupAxiosMock(`utxo/wallet/${walletHash}/?is_cashtoken=true`, tokensResponse, bch._api);

    const result = await bch.send({...tokenSendRequest, recipients: [{
      address: tokenSendRequest.recipients[0].address,
      tokenAmount: undefined
    }]});
    expect(result.success).toBe(false);
    expect(result.error).toContain("can not send 0 fungible tokens");
  })
});

test('Test Wallet', async () => {
  const wallet = new Wallet("https://chipnet.watchtower.cash/api/");
  const walletHash = "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32";
  const address = "bchtest:zzy2xp7p0sxpkspgpmgud5y060uw8d5w6yzlq5eqel"
  // const category = "9bd5b8f1ca10e4034ddd88d3541474a22c78f6d0ae3e2d54d3dfdbc62b34ac8d" // ft
  const category = "17403493f012fd0916f3cb0c14aa385fccfda7415c4d201b2db2b12428e1ecc7" // nft

  // const wallet = new Wallet("https://chipnet.watchtower.cash/api/");
  const bch = new BCH("https://chipnet.watchtower.cash/api/", true);

  // setupAxiosMock(`utxo`, {
  //   valid: true,
  //   wallet: 'f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32',
  //   utxos: [
  //     {
  //       txid: 'd45596de09fe1fff61d43c3cc4d8b5d5c1f89a03b37367e534e586b4e7f4d7f1',
  //       value: 8745,
  //       vout: 1,
  //       block: 148842,
  //       wallet_index: null,
  //       address_path: '0/0'
  //     },
  //     {
  //       txid: '9bd5b8f1ca10e4034ddd88d3541474a22c78f6d0ae3e2d54d3dfdbc62b34ac8d',
  //       value: 9989780,
  //       vout: 1,
  //       block: 148842,
  //       wallet_index: null,
  //       address_path: '0/0'
  //     }
  //   ]
  // }, wallet._api);

  // console.log(await wallet.getBalance({
  //   walletHash: "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32",
  //   index: 0,
  //   tokenId: '',
  //   txid: ''
  // }))

  // console.log(JSON.stringify( await wallet.getHistory({
  //   walletHash: "f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32",
  //   page: 0,
  //   recordType: "all",
  //   tokenId: null
  // }), null, 2))

  // console.log(await wallet.getTokens({ walletHash: walletHash, tokenType: "all" }))
  // console.log((await wallet._api.get(`utxo/ct/${address}/${category}`)).data)
  // console.log((await wallet._api.get(`utxo/ct/${walletHash}/${category}`)).data)
  // console.log((await wallet._api.get(`utxo/ct/${address}`)).data)

  setupAxiosMock(`utxo/wallet/${walletHash}/?is_cashtoken=true`, tokensResponse, bch._api);
  // console.log((await bch._api.get(`utxo/wallet/${walletHash}//?is_cashtoken=true`)).data, `utxo/wallet/${walletHash}//?is_cashtoken=true`)
  // const response = await bch.send(tokenSendRequest as any);
  // console.log(response)

  // const response = await bch.send(tokenNFTSendRequest as any);
  // console.log(response)


  // setupAxiosMock(`utxo/wallet/${walletHash}//?value=${9995032}`, utxosResponse, bch._api);
  // console.log((await bch._api.get(`utxo/wallet/${walletHash}//?value=${9995032}`)).data)

  // const response = await bch.send(sendRequest);
  // const response = await bch.send(sendRequest);
  // console.log(response)

  // https://chipnet.watchtower.cash/api/utxo/wallet/f77bb0c8b2063ba5cd61e8186c51705bab955983e994603dd8a73b2869450e32/?value=9995032


  // console.log((await wallet._api.get(`utxo`)).data)
})
