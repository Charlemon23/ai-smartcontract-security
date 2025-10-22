// scripts/run_pipeline.js
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Load environment variables ===
dotenv.config();

const CONTRACTS_DIR = path.join(__dirname, "../data/contracts/offline_seed");
const REPORTS_DIR = path.join(__dirname, "../data/reports");
const SUMMARY_PATH = path.join(REPORTS_DIR, "summary.json");

fs.ensureDirSync(CONTRACTS_DIR);
fs.ensureDirSync(REPORTS_DIR);

// === Utility: Detect Slither executable ===
function findSlither() {
  try {
    const direct = execSync("which slither", { encoding: "utf8" }).trim();
    if (direct) return direct;
  } catch {}

  // Fallback for virtual environments
  const candidates = [
    "~/.local/bin/slither",
    "/usr/local/bin/slither",
    "/usr/bin/slither",
  ];

  for (const pathGuess of candidates) {
    if (fs.existsSync(pathGuess.replace("~", process.env.HOME))) {
      return pathGuess.replace("~", process.env.HOME);
    }
  }

  // Last resort: Python fallback
  return "python3 -m slither";
}

// === Pipeline start ===
console.log(chalk.cyanBright("\n=== AI Smart Contract Security Testbed ==="));
console.log(chalk.gray(`[${new Date().toISOString()}] Starting analysis...`));

const slitherCmd = "python3 -m slither";
console.log(chalk.gray(`Using analyzer: ${slitherCmd}\n`));

// === Load dataset ===
const contracts = fs
  .readdirSync(CONTRACTS_DIR)
  .filter((f) => f.endsWith(".sol"));

if (contracts.length === 0) {
  console.log(chalk.yellow("⚠️  No Solidity contracts found in dataset."));
  console.log(chalk.gray("Tip: Run `npm run import:dataset` to seed contracts.\n"));
  process.exit(0);
}

console.log(chalk.green(`🧩 Loaded ${contracts.length} contracts.\n`));

// === Analyze each contract ===
const results = [];
for (const contract of contracts) {
  const contractPath = path.join(CONTRACTS_DIR, contract);
  const reportPath = path.join(
    REPORTS_DIR,
    `report_${path.basename(contract, ".sol")}.json`
  );

  console.log(chalk.blueBright(`🔍 Analyzing ${contract}...`));
  try {
    // Run Slither safely
    execSync(`${slitherCmd} "${contractPath}" --json "${reportPath}"`, {
      stdio: "pipe",
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:/home/codespace/.local/bin:/usr/local/bin:/usr/bin`,
      },
      encoding: "utf8",
    });

    console.log(chalk.greenBright(`✅ Analysis complete: ${contract}`));
    results.push({ contract, report: reportPath, status: "success" });
  } catch (err) {
    console.log(chalk.red(`❌ Error analyzing ${contract}`));

    // Parse common errors for cleaner logs
    const message =
      err.stderr?.toString() ||
      err.stdout?.toString() ||
      err.message ||
      "Unknown error";

    fs.writeFileSync(
      reportPath.replace(".json", "_error.log"),
      message.substring(0, 5000)
    );

    results.push({ contract, report: reportPath, status: "failed" });
  }
}

// === Save summary ===
const summary = {
  timestamp: new Date().toISOString(),
  totalContracts: contracts.length,
  successful: results.filter((r) => r.status === "success").length,
  failed: results.filter((r) => r.status === "failed").length,
  reports: results,
};

fs.writeJsonSync(SUMMARY_PATH, summary, { spaces: 2 });

console.log(chalk.magentaBright(`\n📄 Summary saved: ${SUMMARY_PATH}`));
console.log(chalk.green(`\n✅ Pipeline complete.\n`));
