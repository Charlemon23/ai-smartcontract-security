/**
 * Unified Smart Contract Testbed Pipeline
 * Live fetch -> else offline -> else auto-seed and analyze.
 */

import dotenv from "dotenv";
dotenv.config();
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { execSync } = require("child_process");

// ENV
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const BLOCK_WINDOW = parseInt(process.env.BLOCK_WINDOW || "500", 10);
const ETHERSCAN_SLEEP_MS = parseInt(process.env.ETHERSCAN_SLEEP_MS || "225", 10);

// PATHS
const ROOT = path.join(__dirname, "..");
const CONTRACTS_DIR = path.join(ROOT, "data", "contracts");
const REPORTS_DIR = path.join(ROOT, "data", "reports");

// Explorers / RPCs
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* -------- LIVE FETCH -------- */
async function getLatestBlock() {
  // try explorers
  for (const ex of EXPLORERS) {
    try {
      const url = `${ex.url}?module=proxy&action=eth_blockNumber&apikey=${ETHERSCAN_API_KEY || ""}`;
      const { data } = await axios.get(url, { timeout: 7000, family: 4 });
      if (data && typeof data.result === "string" && data.result.startsWith("0x")) {
        const bn = parseInt(data.result, 16);
        if (!Number.isNaN(bn)) {
          console.log(`✅ ${ex.name} responded: block ${bn}`);
          return bn;
        }
      }
      console.warn(`⚠️ ${ex.name} invalid response:`, data);
    } catch (e) {
      console.warn(`❌ ${ex.name} failed: ${e.message}`);
    }
  }
  // try public RPCs
  for (const rpc of RPCS) {
    try {
      const { data } = await axios.post(
        rpc,
        { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 },
        { headers: { "Content-Type": "application/json" }, timeout: 7000 }
      );
      if (data && typeof data.result === "string" && data.result.startsWith("0x")) {
        const bn = parseInt(data.result, 16);
        if (!Number.isNaN(bn)) {
          console.log(`🌐 RPC responded: block ${bn}`);
          return bn;
        }
      }
      console.warn(`⚠️ RPC ${rpc} invalid response:`, data);
    } catch (e) {
      console.warn(`❌ RPC ${rpc} failed: ${e.message}`);
    }
  }
  return null;
}

async function fetchVerifiedContracts(startBlock, endBlock) {
  try {
    const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&startblock=${startBlock}&endblock=${endBlock}&sort=asc&apikey=${ETHERSCAN_API_KEY || ""}`;
    const { data } = await axios.get(url, { timeout: 10000, family: 4 });
    if (data.status === "1" && Array.isArray(data.result)) {
      console.log(`📦 Pulled ${data.result.length} verified contracts.`);
      return data.result;
    }
    console.warn("⚠️ Etherscan returned no verified contracts or a non-OK status.");
  } catch (e) {
    console.error("❌ Fetch error:", e.message);
  }
  return [];
}

/* -------- OFFLINE: DISCOVER / AUTO-SEED -------- */
function findLocalSolidityFiles() {
  // recursive scan for .sol under data/contracts
  const results = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && p.endsWith(".sol")) results.push(p);
    }
  }
  walk(CONTRACTS_DIR);
  return results;
}

async function autoSeedIfEmpty() {
  // prefer copying any .sol from repo /contracts into data/contracts/offline_seed
  let seeded = 0;
  const repoContractsDir = path.join(ROOT, "contracts");
  const seedDir = path.join(CONTRACTS_DIR, "offline_seed");
  await fs.ensureDir(seedDir);

  if (fs.existsSync(repoContractsDir)) {
    const repoFiles = fs.readdirSync(repoContractsDir).filter(f => f.endsWith(".sol"));
    for (const f of repoFiles) {
      const src = path.join(repoContractsDir, f);
      const dst = path.join(seedDir, f);
      await fs.copy(src, dst);
      seeded++;
    }
  }

  // if still nothing, write a minimal SafeBank
  if (seeded === 0) {
    const minimal = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract SafeBank {
    mapping(address=>uint256) private balances;
    function deposit() external payable { balances[msg.sender] += msg.value; }
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
    function getBalance() external view returns (uint256) { return balances[msg.sender]; }
}`;
    await fs.writeFile(path.join(seedDir, "SafeBank.sol"), minimal);
    seeded = 1;
  }
  return seeded;
}

/* -------- ANALYSIS -------- */
async function analyzeWithSlither(solFiles) {
  await fs.ensureDir(REPORTS_DIR);
  if (solFiles.length === 0) {
    console.log("⚠️ No Solidity contracts found. Nothing to analyze.");
    return;
  }
  console.log(`🔍 Starting Slither on ${solFiles.length} contract(s)...\n`);
  for (const f of solFiles) {
    const out = path.join(REPORTS_DIR, `report_${path.basename(f, ".sol")}.json`);
    try {
      execSync(`slither "${f}" --json "${out}" --no-fail-pedantic`, { stdio: "pipe" });
      console.log(`✅ Analyzed: ${path.relative(ROOT, f)} -> ${path.relative(ROOT, out)}`);
      await sleep(300);
    } catch (e) {
      console.warn(`⚠️ Slither warning for ${f}: ${e.message.split("\n")[0]}`);
    }
  }
}

/* -------- MAIN -------- */
(async () => {
  console.log("\n=== AI Smart Contract Security Testbed: Hybrid Mode ===");
  console.log(`[${new Date().toISOString()}] Initializing...\n`);
  await fs.ensureDir(CONTRACTS_DIR);
  await fs.ensureDir(REPORTS_DIR);

  // 1) Try live fetch
  let solFiles = [];
  const latest = await getLatestBlock();
  if (latest) {
    const start = latest - BLOCK_WINDOW;
    const contracts = await fetchVerifiedContracts(start, latest);
    if (contracts.length > 0) {
      // persist fetched contracts
      for (const c of contracts) {
        const name = (c.ContractName && c.ContractName.trim()) || "Contract";
        const folder = path.join(CONTRACTS_DIR, `${name}_${c.ContractAddress || "unknown"}`);
        await fs.ensureDir(folder);
        await fs.writeFile(path.join(folder, `${name}.sol`), c.SourceCode || "");
        await sleep(ETHERSCAN_SLEEP_MS);
      }
      solFiles = findLocalSolidityFiles();
      console.log(`✅ Live mode: saved and discovered ${solFiles.length} file(s).`);
    } else {
      console.log("⚠️ Live mode returned 0 contracts; falling back to offline.");
    }
  } else {
    console.log("⚠️ Could not resolve latest block; falling back to offline.");
  }

  // 2) Offline fallback (discover or seed)
  if (solFiles.length === 0) {
    solFiles = findLocalSolidityFiles();
    if (solFiles.length === 0) {
      const seeded = await autoSeedIfEmpty();
      console.log(`📥 Auto-seeded ${seeded} contract(s) into data/contracts/offline_seed.`);
      solFiles = findLocalSolidityFiles();
    } else {
      console.log(`📂 Found ${solFiles.length} existing local contract(s).`);
    }
  }

  // 3) Analyze
  console.log("\n--- Starting analysis phase ---");
  await analyzeWithSlither(solFiles);

  console.log(`\n📊 Reports saved in: ${REPORTS_DIR}`);
  console.log("🎯 Pipeline complete.\n");
})().catch(e => {
  console.error("Pipeline fatal error:", e);
  process.exit(1);
});
