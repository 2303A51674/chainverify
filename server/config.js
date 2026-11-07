require("dotenv").config();
const fs = require("fs");
const path = require("path");

const NETWORK = process.env.NETWORK || "localhost";
const isProd = process.env.NODE_ENV === "production";
// Hardhat's public default dev account #0 (derived from its well-known mnemonic) – ONLY for local development.
const { ethers } = require("ethers");
const DEV_KEY = ethers.HDNodeWallet.fromPhrase("test test test test test test test test test test test junk").privateKey;

const file = path.join(__dirname, "..", "deployments", `${NETWORK}.json`);
if (!fs.existsSync(file)) {
  console.error(`Missing ${file}. Deploy the contract first (npm run deploy:${NETWORK === "localhost" ? "local" : NETWORK}).`);
  process.exit(1);
}
const deployment = JSON.parse(fs.readFileSync(file, "utf8"));

if (isProd && (!process.env.PRIVATE_KEY || !process.env.ADMIN_KEY)) {
  console.error("In production, PRIVATE_KEY and ADMIN_KEY must be set.");
  process.exit(1);
}

module.exports = {
  NETWORK,
  PORT: process.env.PORT || 3000,
  RPC_URL: process.env.RPC_URL || (NETWORK === "localhost" ? "http://127.0.0.1:8545" : process.env.AMOY_RPC_URL),
  PRIVATE_KEY: process.env.PRIVATE_KEY || (isProd ? undefined : DEV_KEY),
  ADMIN_KEY: process.env.ADMIN_KEY || "admin123",
  ADDRESS: process.env.CONTRACT_ADDRESS || deployment.address,
  ABI: deployment.abi,
  DEPLOY_BLOCK: deployment.deployBlock || 0,
  SCANS_FILE: process.env.SCANS_FILE || path.join(__dirname, "..", "data", "scans.json"),
};
