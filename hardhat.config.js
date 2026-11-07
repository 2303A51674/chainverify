require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY, AMOY_RPC_URL } = process.env;

module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    ...(PRIVATE_KEY && AMOY_RPC_URL
      ? { amoy: { url: AMOY_RPC_URL, accounts: [PRIVATE_KEY], chainId: 80002 } }
      : {}),
  },
};
