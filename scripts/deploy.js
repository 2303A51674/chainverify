const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address, "on", hre.network.name);
  const Factory = await hre.ethers.getContractFactory("ProductRegistry");
  const c = await Factory.deploy();
  await c.waitForDeployment();
  const receipt = await c.deploymentTransaction().wait();
  const address = await c.getAddress();
  const abi = JSON.parse(c.interface.formatJson());
  const out = { network: hre.network.name, address, deployBlock: receipt.blockNumber, abi };
  fs.mkdirSync(path.join(__dirname, "../deployments"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, `../deployments/${hre.network.name}.json`), JSON.stringify(out, null, 2));
  console.log("ProductRegistry deployed to:", address);
  console.log(`Saved deployments/${hre.network.name}.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
