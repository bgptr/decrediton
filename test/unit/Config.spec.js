import { updateDefaultBitcoinConfig } from "../../app/config";
const fs = require("fs");
import os from "os";
jest.mock("fs");
jest.mock("os");
const mockHomeDir = "mockHomeDir";
const mockRpcUser = "mock-rpcuser";
const mockRpcPassword = "mock-password";
const mockRpcBind = "mock-rpcbind";
const mockRpcPort = "mock-rpcport";

const mockExistingRpcUser = "mock-existing-rpcuser";
const mockExistingRpcPassword = "mock-existing-password";
const mockExistingRpcBind = "mock-existing-rpcbind";
const mockExistingRpcPort = "mock-existing-rpcport";

afterEach(() => {
  jest.clearAllMocks();
});

beforeAll(() => {
  fs.writeFileSync.mockReturnValue(false);
  os.platform.mockReturnValue("linux");
  os.homedir.mockReturnValue(mockHomeDir);
});

// default file does not exists, create a new one with args given.
test("call updateDefaultBitcoinConfig on win32 in testnet mode", async () => {
  os.platform.mockReturnValue("win32");

  const testnet = true;
  await updateDefaultBitcoinConfig(
    mockRpcUser,
    mockRpcPassword,
    mockRpcBind,
    mockRpcPort,
    testnet
  );
  expect(fs.writeFileSync).toHaveBeenCalledWith(
    `${mockHomeDir}/AppData/Roaming/Bitcoin/bitcoin.conf`,
    `rpcuser=${mockRpcUser}
rpcpassword=${mockRpcPassword}
server=1

[test]
rpcbind=${mockRpcBind}
rpcport=${mockRpcPort}
`
  );
  expect(os.platform).toHaveBeenCalled();
  expect(os.homedir).toHaveBeenCalled();
});

// default file does not exists, create a new one with args given.
test("call updateDefaultBitcoinConfig on darwin on mainnet, create defaults", async () => {
  os.platform.mockReturnValue("darwin");

  const testnet = false;
  await updateDefaultBitcoinConfig(
    mockRpcUser,
    mockRpcPassword,
    mockRpcBind,
    mockRpcPort,
    testnet
  );
  expect(fs.writeFileSync).toHaveBeenCalledWith(
    `${mockHomeDir}/.bitcoin/bitcoin.conf`,
    `rpcuser=${mockRpcUser}
rpcpassword=${mockRpcPassword}
rpcbind=${mockRpcBind}
rpcport=${mockRpcPort}
server=1
`
  );
  expect(os.platform).toHaveBeenCalled();
  expect(os.homedir).toHaveBeenCalled();
});

test("update an existing empty BTC config, set defaults", async () => {
  fs.existsSync.mockReturnValueOnce(true);
  fs.readFileSync.mockReturnValueOnce("");

  const testnet = false;
  await updateDefaultBitcoinConfig(
    mockRpcUser,
    mockRpcPassword,
    mockRpcBind,
    mockRpcPort,
    testnet
  );
  expect(fs.existsSync).toHaveBeenCalledWith(
    `${mockHomeDir}/.bitcoin/bitcoin.conf`
  );
  expect(fs.writeFileSync).toHaveBeenCalledWith(
    `${mockHomeDir}/.bitcoin/bitcoin.conf`,
    `rpcuser=${mockRpcUser}
rpcpassword=${mockRpcPassword}
server=1
rpcbind=${mockRpcBind}
rpcport=${mockRpcPort}
`
  );
});

test("update an existing BTC config", async () => {
  fs.existsSync.mockReturnValueOnce(true);
  fs.readFileSync.mockReturnValueOnce(
    `rpcuser=${mockExistingRpcUser}
rpcpassword=${mockExistingRpcPassword}
rpcbind=${mockExistingRpcBind}
rpcport=${mockExistingRpcPort}`
  );

  const testnet = false;
  await updateDefaultBitcoinConfig(
    mockRpcUser,
    mockRpcPassword,
    mockRpcBind,
    mockRpcPort,
    testnet
  );
  expect(fs.writeFileSync).toHaveBeenCalledWith(
    `${mockHomeDir}/.bitcoin/bitcoin.conf`,
    `rpcuser=${mockExistingRpcUser}
rpcpassword=${mockExistingRpcPassword}
rpcbind=${mockExistingRpcBind}
rpcport=${mockExistingRpcPort}
server=1
`
  );
});

test.only("update an existing BTC config in testnet mode", async () => {
  fs.existsSync.mockReturnValueOnce(true);
  fs.readFileSync.mockReturnValueOnce(
    `rpcuser=${mockExistingRpcUser}
rpcpassword=${mockExistingRpcPassword}
rpcbind=${mockExistingRpcBind}
rpcport=${mockExistingRpcPort}`
  );

  const testnet = true;
  await updateDefaultBitcoinConfig(
    mockRpcUser,
    mockRpcPassword,
    mockRpcBind,
    mockRpcPort,
    testnet
  );
  expect(fs.writeFileSync).toHaveBeenCalledWith(
    `${mockHomeDir}/.bitcoin/bitcoin.conf`,
    `rpcuser=${mockExistingRpcUser}
rpcpassword=${mockExistingRpcPassword}
rpcbind=${mockExistingRpcBind}
rpcport=${mockExistingRpcPort}
server=1
`
  );
});
