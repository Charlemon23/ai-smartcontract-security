// data_pipeline/fetch_contracts.js
/* Fetches verified Solidity sources of recently created contracts.
 * Strategy:
 *  1) Get latest block (eth_blockNumber)
 *  2) Walk back BLOCK_WINDOW blocks
 *  3) For each block, get txs; if tx.to === null, it's a contract creation
 *  4) Get transaction receipt -> contractAddress
 *  5) Pull verified source via contract.getsourcecode
 * Saves to data/contracts/<address>.sol (or .json if multi-file)
 */

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
require("dotenv").config();

const API = "https://api.etherscan.io/api";
const API_KEY = process.env.ETHERSCAN_API_KEY;
const SLEEP_MS = Number(process.env.ETHERSCAN_SLEEP_MS || 225);
const BLOCK_WINDOW = Number(process.env.BLOCK_WINDOW || 500);
const OUT_DIR = path.join(__dirname, "..", "data", "contracts");
const CACHE_FILE = path.join(__dirname, "..", "data", ".cache", "seen_contracts.json");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function httpGet(url, params) {
  const p = { ...params, apikey: API_KEY };
  const { data } = await axios.get(url, { params: p, timeout: 30_000 });
  await sleep(SLEEP_MS);
  return data;
}

async function loadCache() {
  try { return JSON.parse(await fs.readFile(CACHE_FILE, "utf-8")); }
  catch { return { addresses: {} }; }
}

async function saveCache(cache) {
  await fs.ensureFile(CACHE_FILE);
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function getLatestBlockNumber() {
  const data = await httpGet(API, { module: "proxy", action: "eth_blockNumber" });
  if (!data || !data.result) throw new Error("eth_blockNumber failed");
  return parseInt(data.result, 16);
}

async function getBlock(number) {
  const hex = "0x" + number.toString(16);
  const data = await httpGet(API, {
    module: "proxy",
    action: "eth_getBlockByNumber",
    tag: hex,
    boolean: "true",
  });
  if (!data || !data.result) throw new Error("eth_getBlockByNumber failed");
  return data.result;
}

async function getReceipt(txHash) {
  const data = await httpGet(API, {
    module: "proxy",
    action: "eth_getTransactionReceipt",
    txhash: txHash,
  });
  if (!data || !data.result) throw new Error("eth_getTransactionReceipt failed");
  return data.result;
}

// Save single- or multi-file sources returned by contract.getsourcecode
async function saveSource(address, entry) {
  await fs.ensureDir(OUT_DIR);

  // Multi-file projects come back as JSON (SourceCode often wrapped with {{...}} or {...})
  let sourceCode = entry.SourceCode || "";
  if (!sourceCode.trim()) return false;

  // Handle possible double-brace wrapping
  if (sourceCode.startsWith("{{") && sourceCode.endsWith("}}")) {
    sourceCode = sourceCode.slice(1, -1);
  }
  let wrote = false;
  try {
    const parsed = JSON.parse(sourceCode);
    // assume format: {"sources": {"<path>": {"content": "..."}}, ...}
    if (parsed && parsed.sources) {
      const base = path.join(OUT_DIR, address.toLowerCase());
      await fs.ensureDir(base);
      for (const [filePath, meta] of Object.entries(parsed.sources)) {
        const outPath = path.join(base, filePath);
        await fs.ensureDir(path.dirname(outPath));
        await fs.writeFile(outPath, meta.content ?? "");
      }
      wrote = true;
    }
  } catch {
    // single file solidity
    const outPath = path.join(OUT_DIR, `${address.toLowerCase()}.sol`);
    await fs.writeFile(outPath, sourceCode);
    wrote = true;
  }
  return wrote;
}

async function fetchVerifiedSource(address) {
  const res = await httpGet(API, {
    module: "contract",
    action: "getsourcecode",
    address,
  });
  if (!res || !res.result || !res.result[0]) return false;
  const ok = await saveSource(address, res.result[0]);
  if (ok) console.log(`✅ Saved source for ${address}`);
  return ok;
}

async function main() {
  if (!API_KEY) {
    console.error("Missing ETHERSCAN_API_KEY in .env");
    process.exit(1);
  }
  const cache = await loadCache();
  const seen = cache.addresses || {};
  const latest = await getLatestBlockNumber();
  const start = latest - BLOCK_WINDOW;

  console.log(`Scanning blocks ${start} → ${latest} for new contracts...`);
  let found = 0, saved = 0;

  for (let b = latest; b >= start; b--) {
    try {
      const block = await getBlock(b);
      const txs = block.transactions || [];
      for (const tx of txs) {
        if (tx.to !== null) continue; // contract creations have 'to' == null
        const receipt = await getReceipt(tx.hash);
        const addr = (receipt.contractAddress || "").toLowerCase();
        if (!addr) continue;
        found++;

        if (seen[addr]) continue; // skip already handled
        const ok = await fetchVerifiedSource(addr);
        if (ok) { saved++; seen[addr] = true; await saveCache({ addresses: seen }); }
      }
      if ((latest - b) % 50 === 0) {
        console.log(`Progress: scanned ${latest - b}/${BLOCK_WINDOW} blocks, saved ${saved} contracts`);
      }
    } catch (e) {
      console.warn(`Block ${b} warning: ${e.message}`);
    }
  }
  console.log(`Done. Contracts discovered: ${found}, saved: ${saved}. Sources in data/contracts/`);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
