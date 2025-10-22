// scripts/run_pipeline.js
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Fix __dirname since ES modules don’t define it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// --- Basic paths ---
const CONTRACTS_DIR = path.join(__dirname, "../data/contracts/offline_seed");
const REPORTS_DIR = path.join(__dirname, "../data/reports");

// --- Utility: Check if Slither is installed ---
function slitherInstalled() {
  try {
    execSync("slither --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// --- Step 1: Initialization ---
console.log(chalk.cyanBright("\n=== AI Smart Contract Security Testbed ==="));
console.log(chalk.gray(`[${new Date().toISOString()}] Starting analysis...`));

// Ensure directories exist
fs.ensureDirSync(CONTRACTS_DIR);
fs.ensureDirSync(REPORTS_DIR);

// --- Step 2: Verify Slither availability ---
if (!slitherInstalled()) {
  console.log(
    chalk.redBright(
      "\n❌ Slither not detected. Please install using:\n   pip install slither-analyzer --break-system-packages\n"
    )
  );
  process.exit(1);
}

// --- Step 3: Load dataset ---
const contracts = fs
  .readdirSync(CONTRACTS_DIR)
  .filter((file) => file.endsWith(".sol"));

if (contracts.length === 0) {
  console.log(chalk.yellow("⚠️  No Solidity contracts found in dataset."));
  console.log(
    chalk.gray(
      "Tip: Run `npm run import:dataset` to download verified contracts first.\n"
    )
  );
  process.exit(0);
}

console.log(chalk.green(`\n🧩 Loaded ${contracts.length} contracts.`));

// --- Step 4: Run analysis ---
for (const contract of contracts) {
  const contractPath = path.join(CONTRACTS_DIR, contract);
  const reportFile = path.join(
    REPORTS_DIR,
    `report_${path.basename(contract, ".sol")}.json`
  );

  try {
    console.log(chalk.blueBright(`\n🔍 Analyzing ${contract}...`));
    execSync(`slither ${contractPath} --json ${reportFile}`, {
      stdio: "ignore"
    });
    console.log(chalk.greenBright(`✅  Report saved: ${reportFile}`));
  } catch (err) {
    console.log(chalk.red(`❌  Error analyzing ${contract}: ${err.message}`));
  }
}

// --- Step 5: Summarize results ---
const summary = {
  timestamp: new Date().toISOString(),
  totalContracts: contracts.length,
  reports: contracts.map((file) => ({
    name: file,
    report: `data/reports/report_${path.basename(file, ".sol")}.json`
  }))
};

fs.writeJsonSync(path.join(REPORTS_DIR, "summary.json"), summary, { spaces: 2 });
console.log(chalk.magentaBright("\n📄 Summary saved to data/reports/summary.json"));
console.log(chalk.green("\n✅ Pipeline complete.\n"));
