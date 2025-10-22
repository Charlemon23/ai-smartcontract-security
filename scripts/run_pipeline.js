/**
 * Unified Smart Contract Testbed Pipeline
 * Supports both live API pulls and offline fallback.
 */

require("dotenv").config();
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { execSync } = require("child_process");

// Environment
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const BLOCK_WINDOW = parseInt(process.env.BLOCK_WINDOW || "500");
const ETHERSCAN_SLEEP_MS = parseInt(process.env.ETHERSCAN_SLEEP_MS || "225");

// Directories
const CONTRACTS_DIR = path.join(__dirname, "../data/contracts");
const REPORTS_DIR = path.join(__dirname, "../data/reports");

// Explorers and RPCs
const EXPLORERS = [
  { name: "Etherscan", url: "https://api.etherscan.io/api" },
  { name: "Basescan", url: "https://api.basescan.org/api" },
  { name: "Blockscout", url: "https://blockscout.com/eth/mainnet/api" },
  { name: "Goerli", url: "https://api-goerli.etherscan.io/api" },
];

const RPCS = [
  "https://rpc.ankr.com/eth",
  "https://cloudflare-eth.com",
  "https://eth-mainnet.g.alchemy.com/v2/demo",
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* -------------------------------
   LIVE FETCH SECTION
--------------------------------*/
async function getLatestBlock() {
  for (const explorer of EXPLORERS) {
    try {
      const url = `${explorer.url}?module=proxy&action=eth_blockNumber&apikey=${ETHERSCAN_API_KEY}`;
      const { data } = await axios.get(url, { timeout: 7000, family: 4 });
      if (data && data.result) {
        console.log(`✅ ${explorer.name} responded: block ${parseInt(data.result, 16)}`);
        return parseInt(data.result, 16);
      }
    } catch (err) {
      console.warn(`⚠️ ${explorer.name} failed: ${err.message}`);
    }
  }

  // Try public RPC fallback
  for (const rpc of RPCS) {
    try {
      const { data } = await axios.post(
        rpc,
        { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 },
        { headers: { "Content-Type": "application/json" }, timeout: 7000 }
      );
      if (data && data.result) {
        console.log(`🌐 RPC responded: block ${parseInt(data.result, 16)}`);
        return parseInt(data.result, 16);
      }
    } catch (rpcErr) {
      console.warn(`❌ RPC ${rpc} failed: ${rpcErr.message}`);
    }
  }

  return null;
}

async function fetchVerifiedContracts(startBlock, endBlock) {
  try {
    const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&startblock=${startBlock}&endblock=${endBlock}&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
    const { data } = await axios.get(url, { timeout: 10000, family: 4 });

    if (data.status === "1" && Array.isArray(data.result)) {
      console.log(`📦 Pulled ${data.result.length} verified contracts.`);
      return data.result;
    } else {
      console.warn("⚠️ Etherscan returned no verified contracts.");
      return [];
    }
  } catch (err) {
    console.error("❌ Error fetching verified contracts:", err.message);
    return [];
  }
}

/* -------------------------------
   OFFLINE ANALYSIS SECTION
--------------------------------*/
async function loadLocalContracts() {
  const allContracts = [];
  const dirs = fs.readdirSync(CONTRACTS_DIR, { withFileTypes: true });

  for (const dir of dirs) {
    if (dir.isDirectory()) {
      const subdir = path.join(CONTRACTS_DIR, dir.name);
      const solFiles = fs.readdirSync(subdir).filter((f) => f.endsWith(".sol"));
      for (const f of solFiles) allContracts.push(path.join(subdir, f));
    }
  }

  return allContracts;
}

async function analyzeContracts(solFiles) {
  await fs.ensureDir(REPORTS_DIR);
  if (solFiles.length === 0) {
    console.log("⚠️ No Solidity contracts found.");
    return;
  }

  console.log(`🔍 Starting analysis on ${solFiles.length} contract(s)...`);
  for (const solFile of solFiles) {
    console.log(`🧠 Analyzing ${solFile}...`);
    try {
      execSync(`slither ${solFile} --json ${REPORTS_DIR}/report_${path.basename(solFile, ".sol")}.json`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      console.log(`✅ Slither completed for ${path.basename(solFile)}`);
      await sleep(500);
    } catch (err) {
      console.warn(`⚠️ Slither warning: ${err.message}`);
    }
  }
}

/* -------------------------------
   MAIN PIPELINE
--------------------------------*/
(async () => {
  console.log("\n=== AI Smart Contract Security Testbed: Hybrid Mode ===");
  console.log(`[${new Date().toISOString()}] Initializing...\n`);

  await fs.ensureDir(CONTRACTS_DIR);
  await fs.ensureDir(REPORTS_DIR);

  let useOffline = false;
  let solFiles = [];

  console.log("--- Fetching verified contracts ---");

  const latestBlock = await getLatestBlock();
  if (latestBlock) {
    const startBlock = latestBlock - BLOCK_WINDOW;
    const endBlock = latestBlock;
    console.log(`⛓️ Scanning block range: ${startBlock} → ${endBlock}`);

    const contracts = await fetchVerifiedContracts(startBlock, endBlock);

    if (contracts.length > 0) {
      console.log("✅ Live API mode successful.");
      // Save the fetched contracts
      for (const c of contracts) {
        const folder = path.join(CONTRACTS_DIR, c.ContractName || "UnknownContract");
        const filePath = path.join(folder, `${c.ContractName || "Contract"}.sol`);
        await fs.ensureDir(folder);
        await fs.writeFile(filePath, c.SourceCode || "");
      }
      solFiles = contracts.map((c) => path.join(CONTRACTS_DIR, c.ContractName || "UnknownContract", `${c.ContractName || "Contract"}.sol`));
    } else {
      console.warn("⚠️ No verified contracts found. Switching to offline mode...");
      useOffline = true;
    }
  } else {
    console.warn("⚠️ Failed to get latest block number. Switching to offline mode...");
    useOffline = true;
  }

  if (useOffline) {
    solFiles = await loadLocalContracts();
  }

  console.log("\n--- Starting analysis phase ---");
  await analyzeContracts(solFiles);

  console.log("\n📊 Reports saved in:", REPORTS_DIR);
  console.log("🎯 Pipeline complete.\n");
})();
