import * as cla from "actions/TransactionActions";
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

const transactionActions = cla;
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
