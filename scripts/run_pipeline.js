import fs from "fs-extra";
import { execSync } from "child_process";
import path from "path";
import "dotenv/config";

const CONTRACTS_DIR = "data/contracts/offline_seed";
const REPORTS_DIR = "data/reports";
const SUMMARY_SCRIPT = "scripts/summarize_reports.js";

function runCommand(command, desc) {
  try {
    console.log(`\n=== ${desc} ===`);
    execSync(command, { stdio: "inherit" });
  } catch (err) {
    console.error(`❌ Error during ${desc}:`, err.message);
  }
}

async function main() {
  console.log("\n=== AI Smart Contract Security Testbed ===");
  console.log(`[${new Date().toISOString()}] Starting analysis...`);

  // 1️⃣ Ensure directories exist
  fs.ensureDirSync(CONTRACTS_DIR);
  fs.ensureDirSync(REPORTS_DIR);

  // 2️⃣ Verify contracts exist, else import
  const contracts = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith(".sol"));
  if (contracts.length === 0) {
    console.log("⚠️ No contracts found — importing dataset...");
    runCommand("npm run import:dataset", "Importing verified contracts dataset");
  } else {
    console.log(`✅ Loaded ${contracts.length} contracts.`);
  }

  // 3️⃣ Run analysis on all contracts
  console.log("🔍 Running Slither analysis...");
  for (const file of fs.readdirSync(CONTRACTS_DIR)) {
    if (file.endsWith(".sol")) {
      const inputPath = path.join(CONTRACTS_DIR, file);
      const outputPath = path.join(REPORTS_DIR, `report_${path.basename(file, ".sol")}.json`);
      console.log(`\nAnalyzing ${file}...`);
      try {
        execSync(`python3 -m slither ${inputPath} --json ${outputPath}`, { stdio: "inherit" });
      } catch (err) {
        console.error(`⚠️ Slither error on ${file}: continuing...`);
      }
    }
  }

  // 4️⃣ Generate summary
  console.log("\n🧩 Generating vulnerability summary...");
  runCommand(`node ${SUMMARY_SCRIPT}`, "Summarizing reports");

  console.log("\n✅ Pipeline complete.");
  console.log(`📁 Reports saved in: ${REPORTS_DIR}`);
  console.log(`📝 Summary: ${path.join(REPORTS_DIR, "summary_readable.txt")}`);
}

main();
