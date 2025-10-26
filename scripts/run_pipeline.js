// scripts/run_pipeline.js
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import "dotenv/config";

// === Configuration ===
const CONTRACTS_DIR = "data/contracts/offline_seed";
const REPORTS_DIR = "data/reports";
const SUMMARY_SCRIPT = "scripts/summarize_reports.js";
const COMPARE_SCRIPT = "scripts/compare_results.js";

// === Utility ===
function run(cmd, desc) {
  console.log(`\n=== ${desc} ===`);
  try {
    execSync(cmd, { stdio: "inherit", env: process.env });
  } catch (e) {
    console.error(`⚠️ ${desc} failed:`, e.message);
  }
}

function ensureDirs() {
  fs.ensureDirSync(CONTRACTS_DIR);
  fs.ensureDirSync(REPORTS_DIR);
}

// === Tool Runner Logic ===
function runSlither() {
  console.log("\n🔍 Running Slither analyzer...");
  const files = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith(".sol"));
  const outDir = path.join(REPORTS_DIR, "slither");
  fs.ensureDirSync(outDir);
  for (const f of files) {
    const input = path.join(CONTRACTS_DIR, f);
    const out = path.join(outDir, `slither_${f.replace(".sol", ".json")}`);
    run(`python3 -m slither "${input}" --json "${out}"`, `Analyzing ${f} with Slither`);
  }
}

function runMythril() {
  console.log("\n🔍 Running Mythril analyzer...");
  const files = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith(".sol"));
  const outDir = path.join(REPORTS_DIR, "mythril");
  fs.ensureDirSync(outDir);
  for (const f of files) {
    const input = path.join(CONTRACTS_DIR, f);
    const out = path.join(outDir, `mythril_${f.replace(".sol", ".json")}`);
    run(`myth analyze "${input}" --execution-timeout 60 --outform json > "${out}"`, `Analyzing ${f} with Mythril`);
  }
}

function runOyente() {
  console.log("\n🔍 Running Oyente analyzer...");
  const files = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith(".sol"));
  const outDir = path.join(REPORTS_DIR, "oyente");
  fs.ensureDirSync(outDir);
  for (const f of files) {
    const input = path.join(CONTRACTS_DIR, f);
    const out = path.join(outDir, `oyente_${f.replace(".sol", ".json")}`);
    run(`python3 -m oyente "${input}" --json > "${out}"`, `Analyzing ${f} with Oyente`);
  }
}

// === Summary ===
function summarizeReports() {
  run(`node ${SUMMARY_SCRIPT}`, "Generating summary reports");
}

function compareReports() {
  if (fs.existsSync(COMPARE_SCRIPT)) {
    run(`node ${COMPARE_SCRIPT}`, "Generating comparative summary (Slither vs Mythril vs Oyente)");
  } else {
    console.log("⚙️ Comparative report script not found — skipping.");
  }
}

// === Main Pipeline ===
async function main() {
  console.log("\n=== AI-Enhanced Smart Contract Security Testbed ===");

  ensureDirs();
  const args = process.argv.slice(2);
  const tool = args.find(a => a.startsWith("--tool"))?.split("=")[1];
  const compare = args.includes("--compare");

  if (tool) {
    console.log(`\n🧠 Selected analyzer: ${tool}`);
    if (tool === "slither") runSlither();
    else if (tool === "mythril") runMythril();
    else if (tool === "oyente") runOyente();
    else console.error("❌ Unknown tool:", tool);
    summarizeReports();
  } else if (compare) {
    console.log("\n⚖️ Running comparative analysis across all analyzers...");
    runSlither();
    runMythril();
    runOyente();
    compareReports();
  } else {
    console.log("\n💡 No tool flag provided. Defaulting to Slither only.");
    runSlither();
    summarizeReports();
  }

  console.log("\n✅ Pipeline execution complete.");
  console.log(`📁 Reports saved in: ${REPORTS_DIR}`);
}

main();
