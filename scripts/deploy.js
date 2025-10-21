const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Bank = await ethers.getContractFactory("SafeBank");
  const bank = await Bank.deploy();
  await bank.waitForDeployment();

  console.log("SafeBank deployed to:", await bank.getAddress());
}

main().catch(e => { console.error(e); process.exit(1); });
