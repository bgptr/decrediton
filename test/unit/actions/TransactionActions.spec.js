import * as cla from "actions/TransactionActions";
import * as ca from "actions/ControlActions";
import * as wal from "wallet";
import { createStore } from "test-utils.js";
import {
  mockRegularTransactions,
  mockStakeTransactions,
  mockNormalizedRegularTransactions,
  mockNormalizedStakeTransactions
} from "../components/views/TransactionPage/mocks.js";
import { isEqual, cloneDeep } from "lodash/fp";
import { TestNetParams } from "constants";
import { walletrpc as api } from "middleware/walletrpc/api_pb";
const { TransactionDetails } = api;
import {
  MaxNonWalletOutputs,
  TICKET,
  IMMATURE,
  VOTE,
  VOTED,
  REVOKED
} from "constants";
import { strHashToRaw } from "helpers";

const controlActions = ca;
const transactionActions = cla;
const wallet = wal;
const initialState = {
  settings: {
    currentSettings: {
      network: "testnet"
    }
  },
  grpc: {
    getAccountsResponse: {
      accountsList: [
        {
          accountNumber: 0,
          accountName: "default"
        },
        {
          accountNumber: 1,
          accountName: "account-1"
        },
        {
          accountNumber: 2,
          accountName: "account-2"
        },
        {
          accountNumber: 3,
          accountName: "account-3"
        },
        {
          accountNumber: 4,
          accountName: "account-4"
        },
        {
          accountNumber: 5,
          accountName: "account-5"
        },
        {
          accountNumber: 6,
          accountName: "mixed"
        },
        {
          accountNumber: 7,
          accountName: "unmixed"
        },
        {
          accountNumber: 15,
          accountName: "account-15"
        }
      ]
    }
  }
};
const walletService = "walletService";
const testRawTx = [1, 2, 3];
const testRawTxHex = Buffer.from(testRawTx, "hex");
const mockVspHost = "mock-vsp-host";

let mockGetNextAddressAttempt;
let mockDecodeRawTransaction;
let mockValidateAddress;

beforeEach(() => {
  mockGetNextAddressAttempt = controlActions.getNextAddressAttempt = jest.fn(
    () => () => {}
  );
  mockValidateAddress = wallet.validateAddress = jest.fn(() => ({
    isMine: true
  }));
});

const normalizeTransactions = (txs, store) =>
  Object.keys(txs).reduce((normalizedMap, txHash) => {
    const tx = txs[txHash];
    if (tx.isStake) {
      normalizedMap[txHash] = store.dispatch(
        transactionActions.stakeTransactionNormalizer(tx)
      );
    } else {
      normalizedMap[txHash] = store.dispatch(
        transactionActions.regularTransactionNormalizer(tx)
      );
    }
    return normalizedMap;
  }, {});

test("test transactionNormalizer and ticketNormalizer", () => {
  const store = createStore(initialState);

  const txs = {
    ...cloneDeep(mockRegularTransactions),
    ...cloneDeep(mockStakeTransactions)
  };
  const expectedNormalizedTxs = {
    ...cloneDeep(mockNormalizedRegularTransactions),
    ...cloneDeep(mockNormalizedStakeTransactions)
  };

  const normalizedTransactions = normalizeTransactions(txs, store);
  expect(isEqual(normalizedTransactions, expectedNormalizedTxs)).toBeTruthy();
});

test("test changeTransactionsFilter", () => {
  const testTransactionFilter = {
    search: null,
    listDirection: "desc",
    types: [],
    directions: [],
    maxAmount: null,
    minAmount: null
  };
  const store = createStore({
    grpc: {
      transactionsFilter: testTransactionFilter,
      regularTransactions: "initial",
      getRegularTxsAux: "initial"
    }
  });

  // not changing list direction, regularTransactions and getRegularTxsAux shouldn't touched
  store.dispatch(
    transactionActions.changeTransactionsFilter(testTransactionFilter)
  );
  expect(
    isEqual(store.getState().grpc.transactionsFilter, testTransactionFilter)
  ).toBeTruthy();
  expect(
    isEqual(store.getState().grpc.regularTransactions, "initial")
  ).toBeTruthy();
  expect(
    isEqual(store.getState().grpc.getRegularTxsAux, "initial")
  ).toBeTruthy();

  // change list direction
  const newFilter = { listDirection: "new-listDirection" };
  store.dispatch(transactionActions.changeTransactionsFilter(newFilter));

  expect(
    isEqual(store.getState().grpc.transactionsFilter, newFilter)
  ).toBeTruthy();

  expect(isEqual(store.getState().grpc.regularTransactions, {})).toBeTruthy();
  expect(
    isEqual(store.getState().grpc.getRegularTxsAux, {
      noMoreTransactions: false,
      lastTransaction: null
    })
  ).toBeTruthy();
});

test("test changeTicketsFilter", () => {
  const testTicketsFilter = {
    listDirection: "desc",
    status: null,
    vspFeeStatus: null
  };
  const store = createStore({
    grpc: {
      ticketsFilter: testTicketsFilter,
      stakeTransactions: "initial",
      getStakeTxsAux: "initial"
    }
  });

  // not changing list direction, stakeTransactions and getStakeTxsAux shouldn't touched
  store.dispatch(transactionActions.changeTicketsFilter(testTicketsFilter));
  expect(
    isEqual(store.getState().grpc.ticketsFilter, testTicketsFilter)
  ).toBeTruthy();
  expect(
    isEqual(store.getState().grpc.stakeTransactions, "initial")
  ).toBeTruthy();
  expect(isEqual(store.getState().grpc.getStakeTxsAux, "initial")).toBeTruthy();

  // change list direction
  const newFilter = { listDirection: "new-listDirection" };
  store.dispatch(transactionActions.changeTicketsFilter(newFilter));

  expect(isEqual(store.getState().grpc.ticketsFilter, newFilter)).toBeTruthy();

  expect(isEqual(store.getState().grpc.stakeTransactions, {})).toBeTruthy();
  expect(
    isEqual(store.getState().grpc.getStakeTxsAux, {
      noMoreTransactions: false,
      lastTransaction: null
    })
  ).toBeTruthy();
});

test("test checkAccountsToUpdate function", () => {
  // update accounts related to the transaction balance.
  const newlyUnminedTransactions = [
    {
      credits: [{ account: 0 }, { account: 1 }],
      debits: [{ previousAccount: 2 }, { previousAccount: 3 }]
    }
  ];

  const newlyMinedTransactions = [
    {
      credits: [{ account: 4 }, { account: 5 }],
      debits: [{ previousAccount: 6 }, { previousAccount: 7 }]
    },
    // duplicates
    {
      credits: [{ account: 1 }, { account: 1 }],
      debits: [{ previousAccount: 6 }, { previousAccount: 6 }]
    }
  ];
  //

  const accountsToUpdate = transactionActions.checkAccountsToUpdate([
    ...newlyUnminedTransactions,
    ...newlyMinedTransactions
  ]);

  expect(isEqual(accountsToUpdate, [0, 1, 2, 3, 4, 5, 6, 7])).toBeTruthy();
});

test("test transactionsMaturingHeights function", () => {
  const txs = [
    {
      height: 10,
      type: TransactionDetails.TransactionType.TICKET_PURCHASE,
      credits: [{ account: 4 }, { account: 5 }],
      debits: [{ previousAccount: 6 }, { previousAccount: 7 }]
    },
    {
      height: 10, // same height
      type: TransactionDetails.TransactionType.TICKET_PURCHASE,
      credits: [{ account: 4 }, { account: 5 }, { account: 9 }], // additional account
      debits: [{ previousAccount: 6 }, { previousAccount: 7 }]
    },
    {
      height: 100,
      type: TransactionDetails.TransactionType.TICKET_PURCHASE,
      credits: [{ account: 4 }],
      debits: [{ previousAccount: 7 }]
    },
    {
      height: 200,
      type: TransactionDetails.TransactionType.VOTE,
      credits: [{ account: 5 }],
      debits: [{ previousAccount: 6 }]
    },
    {
      height: 200,
      type: TransactionDetails.TransactionType.REVOCATION,
      credits: [{ account: 5 }],
      debits: [{ previousAccount: 6 }]
    },
    {
      height: 300,
      type: TransactionDetails.TransactionType.VOTE,
      credits: [{ account: 9 }],
      debits: [{ previousAccount: 9 }]
    }
  ];
  const res = transactionActions.transactionsMaturingHeights(
    txs,
    TestNetParams
  );
  expect(
    isEqual(res, {
      11: [4, 5, 6, 7, 9], // height(10) +  SStxChangeMaturity(1)
      26: [4, 5, 6, 7, 9], // height(10) +  TicketMaturity(16)
      6154: [4, 5, 6, 7, 9], // height(10) +  TicketExpiry(6144)

      101: [4, 7], // height(100) +  SStxChangeMaturity(1)
      116: [4, 7], // height(100) +  TicketMaturity(16)
      6244: [4, 7], // height(100) +  TicketExpiry(6144)

      216: [5, 6], // height(200) +  CoinbaseMaturity(16)

      316: [9] // height(200) +  CoinbaseMaturity(16)
    })
  ).toBeTruthy();
});

test("test getNewAccountAddresses function", () => {
  const store = createStore({});
  const txs = [
    {
      credits: [{ account: 4 }, { account: 5 }]
    },
    {
      credits: [{ account: 4 }, { account: 5 }, { account: 9 }] // additional account
    },
    {
      credits: [{ account: 4 }]
    }
  ];
  store.dispatch(transactionActions.getNewAccountAddresses(txs));

  expect(mockGetNextAddressAttempt).toHaveBeenNthCalledWith(1, 4);
  expect(mockGetNextAddressAttempt).toHaveBeenNthCalledWith(2, 5);
  expect(mockGetNextAddressAttempt).toHaveBeenNthCalledWith(3, 9);
});

test("test checkForStakeTransactions function", () => {
  expect(
    transactionActions.checkForStakeTransactions([
      {
        isStake: undefined
      }
    ])
  ).toBeFalsy();

  expect(
    transactionActions.checkForStakeTransactions([
      {
        isStake: false
      },
      {
        isStake: false
      }
    ])
  ).toBeFalsy();

  expect(
    transactionActions.checkForStakeTransactions([
      {
        isStake: true
      },
      {
        isStake: false
      },
      {
        isStake: undefined
      }
    ])
  ).toBeTruthy();
});

test("test divideTransactions function", () => {
  const txs = [
    {
      txHash: "stakeTxHash",
      isStake: true
    },
    {
      txHash: "regularTxHash",
      isStake: false
    },
    {
      txHash: "unknownTxHash",
      isStake: undefined
    },
    {
      txHash: "stakeTxHash2",
      isStake: true
    }
  ];
  const res = transactionActions.divideTransactions(txs);
  expect(
    isEqual(res, {
      stakeTransactions: {
        stakeTxHash: { txHash: "stakeTxHash", isStake: true },
        stakeTxHash2: { txHash: "stakeTxHash2", isStake: true }
      },
      regularTransactions: {
        regularTxHash: { txHash: "regularTxHash", isStake: false },
        unknownTxHash: { txHash: "unknownTxHash", isStake: undefined }
      }
    })
  ).toBeTruthy();
});

test("test getNonWalletOutputs function (called with less than MaxNonWalletOutputs)", async () => {
  const tx = {
    rawTx: [1, 2, 3]
  };
  const mockDecodedTx = {
    outputs: [
      { decodedScript: { address: "test-address-1" }, value: 1 },
      { decodedScript: { address: "test-address-2" }, value: 2 }
    ]
  };
  mockDecodeRawTransaction = wallet.decodeRawTransaction = jest.fn(
    () => mockDecodedTx
  );
  mockValidateAddress = wallet.validateAddress = jest.fn((_, address) => ({
    // first output will be mine, the rest is not
    isMine: address === mockDecodedTx.outputs[0].decodedScript.address
  }));
  const updatedOutputs = await transactionActions.getNonWalletOutputs(
    walletService,
    TestNetParams,
    tx
  );
  expect(mockDecodeRawTransaction).toHaveBeenCalledWith(
    testRawTxHex,
    TestNetParams
  );
  expect(mockValidateAddress).toHaveBeenCalledTimes(
    mockDecodedTx.outputs.length
  );
  expect(mockValidateAddress).toHaveBeenNthCalledWith(
    1,
    walletService,
    "test-address-1"
  );
  expect(mockValidateAddress).toHaveBeenNthCalledWith(
    2,
    walletService,
    "test-address-2"
  );
  expect(
    isEqual(updatedOutputs, [
      { address: "test-address-1", value: 1, isChange: true },
      { address: "test-address-2", value: 2, isChange: false }
    ])
  ).toBeTruthy();
});

test("test getNonWalletOutputs function (called with more outputs than MaxNonWalletOutputs)", async () => {
  const tx = {
    rawTx: [1, 2, 3]
  };
  const mockDecodedTx = {
    outputs: []
  };

  for (let i = 0; i <= MaxNonWalletOutputs + 1; i++) {
    mockDecodedTx.outputs.push({
      decodedScript: { address: `test-address-${i}` },
      value: i
    });
  }

  mockDecodeRawTransaction = wallet.decodeRawTransaction = jest.fn(
    () => mockDecodedTx
  );
  const updatedOutputs = await transactionActions.getNonWalletOutputs(
    walletService,
    TestNetParams,
    tx
  );
  expect(mockDecodeRawTransaction).toHaveBeenCalledWith(
    testRawTxHex,
    TestNetParams
  );
  expect(mockValidateAddress).not.toHaveBeenCalled();
  expect(
    isEqual(
      updatedOutputs,
      mockDecodedTx.outputs.map((output) => ({
        address: output.decodedScript.address,
        value: output.value
      }))
    )
  ).toBeTruthy();
});

test("test getNonWalletOutputs function fails", async () => {
  const tx = {
    rawTx: [1, 2, 3]
  };

  mockDecodeRawTransaction = wallet.decodeRawTransaction = jest.fn(() => {
    throw "error";
  });
  let error;
  try {
    const updatedOutputs = await transactionActions.getNonWalletOutputs(
      walletService,
      TestNetParams,
      tx
    );
  } catch (e) {
    error = e;
  }
  expect(mockDecodeRawTransaction).toHaveBeenCalledWith(
    testRawTxHex,
    TestNetParams
  );
  expect(mockValidateAddress).not.toHaveBeenCalled();
  expect(isEqual(error, "error")).toBeTruthy();
});

test("test getMissingStakeTxData function (REVOKED)", async () => {
  const tx = {
    rawTx: [1, 2, 3]
  };
  const mockDecodedTx = {
    inputs: [{ prevTxId: "test-prev-tx-id-1" }]
  };
  const mockTicket = {
    ticket: "e3bae353b60cb90af66e277ce80fa238e942675e3a2cbe45331b9a010dd006bc"
  };
  mockDecodeRawTransaction = wallet.decodeRawTransaction = jest.fn(
    () => mockDecodedTx
  );

  const mockGetTicket = (wallet.getTicket = jest.fn(() => mockTicket));
  const res = await transactionActions.getMissingStakeTxData(
    walletService,
    TestNetParams,
    tx
  );
  expect(mockGetTicket).toHaveBeenCalledWith(
    walletService,
    strHashToRaw(mockDecodedTx.inputs[0].prevTxId)
  );
  expect(mockDecodeRawTransaction).toHaveBeenCalledWith(
    testRawTxHex,
    TestNetParams
  );
  expect(
    isEqual(res, { ticket: mockTicket.ticket, spender: tx, status: REVOKED })
  ).toBeTruthy();
});

test("test getMissingStakeTxData function (REVOKED, more than one inputs)", async () => {
  const tx = {
    rawTx: [1, 2, 3]
  };
  const mockDecodedTx = {
    inputs: [
      {
        prevTxId:
          "e3bae353b60cb90af66e277ce80fa238e942675e3a2cbe45331b9a010dd006bc"
      },
      {
        prevTxId:
          "045bd5f19c97b926fe4d090c06a2c25481f5f32d5cefc31ffb36ef86e140b199"
      },
      {
        prevTxId:
          "51cd137ae3bbe9acebd9dc6b364b6bf8350602db783e78de6a345f264d592068"
      }
    ]
  };
  const mockTicket = { ticket: "test-ticket-data" };
  mockDecodeRawTransaction = wallet.decodeRawTransaction = jest.fn(
    () => mockDecodedTx
  );

  const mockGetTicket = (wallet.getTicket = jest.fn(() => mockTicket));
  const res = await transactionActions.getMissingStakeTxData(
    walletService,
    TestNetParams,
    tx
  );
  expect(mockGetTicket).toHaveBeenCalledWith(
    walletService,
    strHashToRaw(mockDecodedTx.inputs[1].prevTxId) // use the second input, if it's present
  );
  expect(mockDecodeRawTransaction).toHaveBeenCalledWith(
    testRawTxHex,
    TestNetParams
  );
  expect(
    isEqual(res, { ticket: mockTicket.ticket, spender: tx, status: REVOKED })
  ).toBeTruthy();
});

test("test getMissingStakeTxData function (VOTED)", async () => {
  const tx = {
    rawTx: [1, 2, 3],
    txType: VOTE
  };
  const mockDecodedTx = {
    inputs: [{ prevTxId: "test-prev-tx-id-1" }]
  };
  const mockTicket = {
    ticket: "e3bae353b60cb90af66e277ce80fa238e942675e3a2cbe45331b9a010dd006bc"
  };
  mockDecodeRawTransaction = wallet.decodeRawTransaction = jest.fn(
    () => mockDecodedTx
  );

  const mockGetTicket = (wallet.getTicket = jest.fn(() => mockTicket));
  const res = await transactionActions.getMissingStakeTxData(
    walletService,
    TestNetParams,
    tx
  );
  expect(mockGetTicket).toHaveBeenCalledWith(
    walletService,
    strHashToRaw(mockDecodedTx.inputs[0].prevTxId)
  );
  expect(mockDecodeRawTransaction).toHaveBeenCalledWith(
    testRawTxHex,
    TestNetParams
  );
  expect(
    isEqual(res, { ticket: mockTicket.ticket, spender: tx, status: VOTED })
  ).toBeTruthy();
});

test("test getMissingStakeTxData function (VOTED, ticket NOT_FOUND)", async () => {
  const tx = {
    rawTx: [1, 2, 3],
    txType: VOTE
  };
  const mockDecodedTx = {
    inputs: [{ prevTxId: "test-prev-tx-id-1" }]
  };
  mockDecodeRawTransaction = wallet.decodeRawTransaction = jest.fn(
    () => mockDecodedTx
  );

  const mockGetTicket = (wallet.getTicket = jest.fn(() => {
    throw "NOT_FOUND";
  }));
  const res = await transactionActions.getMissingStakeTxData(
    walletService,
    TestNetParams,
    tx
  );
  expect(mockGetTicket).toHaveBeenCalledWith(
    walletService,
    strHashToRaw(mockDecodedTx.inputs[0].prevTxId)
  );
  expect(mockDecodeRawTransaction).toHaveBeenCalledWith(
    testRawTxHex,
    TestNetParams
  );
  expect(
    isEqual(res, { ticket: undefined, spender: tx, status: VOTED })
  ).toBeTruthy();
});

test("test getMissingStakeTxData function (VOTED, getting tickket fails with unknown error)", async () => {
  const tx = {
    rawTx: [1, 2, 3],
    txType: VOTE
  };
  const mockDecodedTx = {
    inputs: [{ prevTxId: "test-prev-tx-id-1" }]
  };
  mockDecodeRawTransaction = wallet.decodeRawTransaction = jest.fn(
    () => mockDecodedTx
  );

  const mockGetTicket = (wallet.getTicket = jest.fn(() => {
    throw "UNKNOWN_ERROR";
  }));
  let error;
  let res;
  try {
    res = await transactionActions.getMissingStakeTxData(
      walletService,
      TestNetParams,
      tx
    );
  } catch (e) {
    error = e;
  }
  expect(error).toBe("UNKNOWN_ERROR");
  expect(mockGetTicket).toHaveBeenCalledWith(
    walletService,
    strHashToRaw(mockDecodedTx.inputs[0].prevTxId)
  );
  expect(mockDecodeRawTransaction).toHaveBeenCalledWith(
    testRawTxHex,
    TestNetParams
  );
  expect(res).toBe(undefined);
});

test("test getMissingStakeTxData function (TICKET)", async () => {
  const tx = {
    rawTx: [1, 2, 3],
    txType: TICKET,
    txHash: "caa80c92647a4b7cc205de8326a1759138be6a9a884e7984b3cf908aa4a840db"
  };
  const mockTicket = {
    status: IMMATURE,
    spender: {
      hash: "045bd5f19c97b926fe4d090c06a2c25481f5f32d5cefc31ffb36ef86e140b199"
    },
    ticket: {
      vspHost: mockVspHost
    }
  };
  const mockTransaction = "mock-transaction";
  const mockGetTicket = (wallet.getTicket = jest.fn(() => mockTicket));
  const mockGetTransaction = (wallet.getTransaction = jest.fn(
    () => mockTransaction
  ));
  const res = await transactionActions.getMissingStakeTxData(
    walletService,
    TestNetParams,
    tx
  );
  expect(mockGetTicket).toHaveBeenCalledWith(
    walletService,
    strHashToRaw(tx.txHash)
  );
  expect(mockGetTransaction).toHaveBeenCalledWith(
    walletService,
    mockTicket.spender.hash
  );
  expect(
    isEqual(res, {
      ticket: { ...tx, vspHost: mockVspHost },
      spender: mockTransaction,
      status: IMMATURE
    })
  ).toBeTruthy();
});

test("test getMissingStakeTxData function (TICKET, transaction is NOT_FOUND)", async () => {
  const tx = {
    rawTx: [1, 2, 3],
    txType: TICKET,
    txHash: "caa80c92647a4b7cc205de8326a1759138be6a9a884e7984b3cf908aa4a840db"
  };
  const mockTicket = {
    status: IMMATURE,
    spender: {
      hash: "045bd5f19c97b926fe4d090c06a2c25481f5f32d5cefc31ffb36ef86e140b199"
    },
    ticket: {
      vspHost: mockVspHost
    }
  };
  const mockGetTicket = (wallet.getTicket = jest.fn(() => mockTicket));
  const mockGetTransaction = (wallet.getTransaction = jest.fn(() => {
    throw "NOT_FOUND";
  }));
  const res = await transactionActions.getMissingStakeTxData(
    walletService,
    TestNetParams,
    tx
  );
  expect(mockGetTicket).toHaveBeenCalledWith(
    walletService,
    strHashToRaw(tx.txHash)
  );
  expect(mockGetTransaction).toHaveBeenCalledWith(
    walletService,
    mockTicket.spender.hash
  );
  expect(
    isEqual(res, {
      ticket: { ...tx, vspHost: mockVspHost },
      spender: undefined,
      status: IMMATURE
    })
  ).toBeTruthy();
});

test("test getMissingStakeTxData function (TICKET, spender hash is missing)", async () => {
  const tx = {
    rawTx: [1, 2, 3],
    txType: TICKET,
    txHash: "caa80c92647a4b7cc205de8326a1759138be6a9a884e7984b3cf908aa4a840db"
  };
  const mockTicket = {
    status: IMMATURE,
    spender: {},
    ticket: {
      vspHost: mockVspHost
    }
  };
  const mockGetTicket = (wallet.getTicket = jest.fn(() => mockTicket));
  const res = await transactionActions.getMissingStakeTxData(
    walletService,
    TestNetParams,
    tx
  );
  expect(mockGetTicket).toHaveBeenCalledWith(
    walletService,
    strHashToRaw(tx.txHash)
  );
  expect(
    isEqual(res, {
      ticket: { ...tx, vspHost: mockVspHost },
      spender: undefined,
      status: IMMATURE
    })
  ).toBeTruthy();
});

test("test getMissingStakeTxData function (TICKET, getting ticket fails with unknown error)", async () => {
  const tx = {
    rawTx: [1, 2, 3],
    txType: TICKET,
    txHash: "caa80c92647a4b7cc205de8326a1759138be6a9a884e7984b3cf908aa4a840db"
  };
  const mockGetTicket = (wallet.getTicket = jest.fn(() => {
    throw "UNKNOWN_ERROR";
  }));
  let error;
  let res;
  try {
    res = await transactionActions.getMissingStakeTxData(
      walletService,
      TestNetParams,
      tx
    );
  } catch (e) {
    error = e;
  }
  expect(error).toBe("UNKNOWN_ERROR");
  expect(mockGetTicket).toHaveBeenCalledWith(
    walletService,
    strHashToRaw(tx.txHash)
  );
  expect(res).toBe(undefined);
});
