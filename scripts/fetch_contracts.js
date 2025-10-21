/**
 * Fetches recently verified contracts from Etherscan and saves source code to /data/contracts/.
 * Uses .env for ETHERSCAN_API_KEY, BLOCK_WINDOW, and ETHERSCAN_SLEEP_MS.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const BLOCK_WINDOW = parseInt(process.env.BLOCK_WINDOW || "500");
const ETHERSCAN_SLEEP_MS = parseInt(process.env.ETHERSCAN_SLEEP_MS || "225");

const DATA_DIR = path.join(__dirname, "../data/contracts");
const API_BASE = "https://api.etherscan.io/api";

if (!ETHERSCAN_API_KEY) {
  console.error("❌ Missing ETHERSCAN_API_KEY in .env file.");
  process.exit(1);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getLatestBlock() {
  try {
    const url = `${API_BASE}?module=proxy&action=eth_blockNumber&apikey=${ETHERSCAN_API_KEY}`;
    console.log(`Fetching latest block number from: ${url}`);
    const { data } = await axios.get(url, { family: 4 }); // Force IPv4 to prevent DNS issues
    console.log("Etherscan response:", data);

    if (data && data.result) {
      return parseInt(data.result, 16);
    } else {
      console.error("⚠️ Invalid response from Etherscan:", data);
      throw new Error("Could not retrieve latest block number");
    }
  } catch (err) {
    console.error("Error fetching latest block:", err.message);
    return null;
  }
}


async function fetchContracts(startBlock, endBlock) {
  const url = `${API_BASE}?module=contract&action=getsourcecode&startblock=${startBlock}&endblock=${endBlock}&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
  try {
    const { data } = await axios.get(url);
    if (data.status !== "1" || !Array.isArray(data.result)) {
      console.log("⚠️ No new verified contracts in this range.");
      return [];
    }
    return data.result;
  } catch (err) {
    console.error("Fetch error:", err.message);
    return [];
  }
}

async function saveContract(contract) {
  const address = contract.ContractAddress;
  const name = contract.ContractName || "UnknownContract";
  const folder = path.join(DATA_DIR, `${name}_${address}`);
  const filePath = path.join(folder, `${name}.sol`);

  await fs.ensureDir(folder);
  await fs.writeFile(filePath, contract.SourceCode || "");
  return filePath;
}

async function main() {
  console.log("=== Fetching verified contracts from Etherscan ===");

  const latestBlock = await getLatestBlock();
  if (!latestBlock) {
    console.error("❌ Failed to retrieve latest block number.");
    return;
  }

  const startBlock = latestBlock - BLOCK_WINDOW;
  const endBlock = latestBlock;

  console.log(`⛓️ Scanning blocks ${startBlock} → ${endBlock}`);

  const contracts = await fetchContracts(startBlock, endBlock);
  console.log(`Found ${contracts.length} verified contracts.`);

  if (contracts.length === 0) return;

  let savedCount = 0;
  for (const contract of contracts) {
    try {
      await saveContract(contract);
      savedCount++;
      console.log(`✅ Saved ${contract.ContractName} at ${contract.ContractAddress}`);
      await sleep(ETHERSCAN_SLEEP_MS);
    } catch (err) {
      console.warn(`⚠️ Failed to save contract ${contract.ContractAddress}: ${err.message}`);
    }
  }

  console.log(`\n🎉 Saved ${savedCount} contract(s) in ${DATA_DIR}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error:", err.message);
    process.exit(1);
  });
}
