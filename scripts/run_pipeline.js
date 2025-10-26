// scripts/run_pipeline.js
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import "dotenv/config";

const CONTRACTS_DIR = "data/contracts/offline_seed";
const REPORTS_DIR = "data/reports";
const SUMMARY_SCRIPT = "scripts/summarize_reports.js";

function run(cmd, label) {
  console.log(`\n=== ${label} ===`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

function ensureDirs() {
  fs.ensureDirSync(CONTRACTS_DIR);
  fs.ensureDirSync(REPORTS_DIR);
}

function ensureDataset() {
  const sols = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith(".sol"));
  if (sols.length === 0) {
    console.log("No contracts found — seeding local dataset...");
    run("node scripts/import_dataset.js", "Seeding offline dataset");
  } else {
    console.log(`✅ Found ${sols.length} local contracts.`);
  }
}

function analyzeAll() {
  const files = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith(".sol"));
  if (files.length === 0) {
    console.log("⚠️ No contracts to analyze.");
    return;
  }

  console.log(`\n🔍 Running Slither analysis on ${files.length} contract(s)...`);
  for (const file of files) {
    const input = path.join(CONTRACTS_DIR, file);
    const out = path.join(REPORTS_DIR, `report_${path.basename(file, ".sol")}.json`);
    try {
      run(`bash -c "python3 -m slither '${input}' --json '${out}'"`, `Analyzing ${file}`);
    } catch {
      console.error(`⚠️ Slither reported an error on ${file}. Continuing...`);
    }
  }
}

function summarize() {
  run("node scripts/summarize_reports.js", "Summarizing reports");
}

(async function main() {
  console.log("\n=== AI Smart Contract Security Testbed (Offline/Deterministic) ===");
  ensureDirs();
  ensureDataset();
  analyzeAll();
  summarize();
  console.log(`\n✅ Pipeline complete.\n📁 Reports: ${REPORTS_DIR}\n📝 Summary: ${path.join(REPORTS_DIR, "summary_readable.txt")}`);
})();