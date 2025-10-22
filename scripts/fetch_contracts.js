/**
 * Fetch verified smart contracts from Etherscan or fallback explorers.
 * Works even if Etherscan key is private or region-blocked.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const BLOCK_WINDOW = parseInt(process.env.BLOCK_WINDOW || "500");
const ETHERSCAN_SLEEP_MS = parseInt(process.env.ETHERSCAN_SLEEP_MS || "225");

const DATA_DIR = path.join(__dirname, "../data/contracts");

// Main and fallback explorers
const EXPLORERS = [
  { name: "Etherscan", url: "https://api.etherscan.io/api" },
  { name: "Basescan", url: "https://api.basescan.org/api" },
  { name: "Blockscout", url: "https://blockscout.com/eth/mainnet/api" },
  { name: "Goerli", url: "https://api-goerli.etherscan.io/api" },
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getLatestBlock(apiBase, name) {
  try {
    const url = `${apiBase}?module=proxy&action=eth_blockNumber&apikey=${ETHERSCAN_API_KEY}`;
    console.log(`🔍 Trying ${name}: ${url}`);
    const { data } = await axios.get(url, { family: 4, timeout: 7000 });

    if (data && data.result) {
      console.log(`✅ ${name} responded: block ${parseInt(data.result, 16)}`);
      return parseInt(data.result, 16);
    } else {
      console.warn(`⚠️ ${name} invalid response:`, data);
      return null;
    }
  } catch (err) {
    console.warn(`❌ ${name} failed: ${err.message}`);
    return null;
  }
}

async function fetchContracts(apiBase, startBlock, endBlock, name) {
  const url = `${apiBase}?module=contract&action=getsourcecode&startblock=${startBlock}&endblock=${endBlock}&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
  try {
    const { data } = await axios.get(url, { family: 4, timeout: 10000 });
    if (data.status !== "1" || !Array.isArray(data.result)) {
      console.log(`⚠️ ${name}: No verified contracts in this range.`);
      return [];
    }
    return data.result;
  } catch (err) {
    console.error(`Fetch error from ${name}:`, err.message);
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
  console.log("=== Fetching verified contracts from available explorers ===");

  let latestBlock = null;
  let explorerUsed = null;

  // Try each explorer until one responds
  for (const explorer of EXPLORERS) {
    latestBlock = await getLatestBlock(explorer.url, explorer.name);
    if (latestBlock) {
      explorerUsed = explorer;
      break;
    }
  }

  if (!latestBlock) {
    console.error("❌ Failed to get block number from all explorers. Aborting.");
    return;
  }

  const startBlock = latestBlock - BLOCK_WINDOW;
  const endBlock = latestBlock;

  console.log(`⛓️ Using ${explorerUsed.name}: Scanning blocks ${startBlock} → ${endBlock}`);

  const contracts = await fetchContracts(explorerUsed.url, startBlock, endBlock, explorerUsed.name);
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
