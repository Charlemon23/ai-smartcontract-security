// scanner/analyze_contracts.js
/*
 * Scans all Solidity contracts in data/contracts/ using Slither (preferred)
 * or Mythril if Slither is unavailable. Outputs JSON reports to data/reports/
 * and a CSV summary of all results.
 */

const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");
const os = require("os");

const BASE_DIR = path.join(__dirname, "..", "data");
const CONTRACTS_DIR = path.join(BASE_DIR, "contracts");
const REPORTS_DIR = path.join(BASE_DIR, "reports");
const LOGS_DIR = path.join(BASE_DIR, "logs");
const SUMMARY_CSV = path.join(REPORTS_DIR, "summary.csv");

// ---------- Utility Functions ----------

async function which(bin) {
  return new Promise((resolve) => {
    exec(process.platform === "win32" ? `where ${bin}` : `which ${bin}`, (err, stdout) => {
      if (err) return resolve(null);
      resolve(stdout.toString().trim() || null);
    });
  });
}

function run(cmd, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout || "");
    });
  });
}

async function safeEnsureDir(dirPath) {
  try {
    await fs.ensureDir(dirPath);
  } catch (e) {
    console.warn(`Warning: could not ensure directory ${dirPath}: ${e.message}`);
  }
}

// ---------- Scanning Logic ----------

async function scanWithSlither(targetPath, outJsonPath) {
  const cmd = `slither "${targetPath}" --json "${outJsonPath}" --no-fail-pedantic --solc-remaps @=./node_modules/@`;
  await run(cmd, path.dirname(targetPath));
}

async function scanWithMythril(targetPath, outJsonPath) {
  const cmd = `myth analyze "${targetPath}" --execution-timeout 60 --max-depth 30 -o json > "${outJsonPath}"`;
  await run(cmd, path.dirname(targetPath));
}

function findContracts() {
  if (!fs.existsSync(CONTRACTS_DIR)) {
    console.warn("⚠️  No contracts directory found. Make sure you ran fetch_contracts.js first.");
    return [];
  }

  const items = fs.readdirSync(CONTRACTS_DIR);
  const targets = [];

  for (const name of items) {
    const full = path.join(CONTRACTS_DIR, name);
    const stat = fs.statSync(full);

    if (stat.isFile() && name.endsWith(".sol")) {
      targets.push(full);
    } else if (stat.isDirectory()) {
      const candidates = fs.readdirSync(full).filter((f) => f.endsWith(".sol"));
      const main = candidates.find((f) => !f.toLowerCase().includes("test")) || candidates[0];
      if (main) targets.push(path.join(full, main));
    }
  }

  return targets;
}

function extractFindings(reportPath) {
  try {
    const raw = fs.readFileSync(reportPath, "utf-8");
    const data = JSON.parse(raw);
    let issues = [];

    // Slither JSON structure
    if (data && data.results && data.results.detectors) {
      issues = data.results.detectors.map((d) => ({
        check: d.check,
        impact: d.impact || "",
        confidence: d.confidence || "",
      }));
    }

    // Mythril JSON structure
    if (Array.isArray(data)) {
      issues = data.map((i) => ({
        check: i.issue_type || i.title || "finding",
        impact: i.severity || "",
        confidence: i.confidence || "",
      }));
    }

    return issues;
  } catch {
    return [];
  }
}

// ---------- Main ----------

async function main() {
  console.log("🔍 Starting contract analysis...");

  await safeEnsureDir(REPORTS_DIR);
  await safeEnsureDir(LOGS_DIR);

  const slitherBin = await which("slither");
  const mythrilBin = await which("myth");
  const useSlither = !!slitherBin;

  const toolName = useSlither ? "Slither" : mythrilBin ? "Mythril" : "None";

  console.log(`🧠 Scanner tool selected: ${toolName}`);
  if (toolName === "None") {
    console.error("❌ No analysis tools found (install Slither or Mythril).");
    process.exit(2);
  }

  const targets = findContracts();
  if (!targets.length) {
    console.warn("⚠️  No Solidity contracts found in data/contracts/");
    return;
  }

  const rows = [["contract_path", "tool", "issues_count", "notes"]];

  for (const target of targets) {
    const addressLike = path.basename(target).replace(".sol", "").toLowerCase();
    const outJson = path.join(REPORTS_DIR, `${addressLike}.json`);
    try {
      if (useSlither) await scanWithSlither(target, outJson);
      else await scanWithMythril(target, outJson);

      const issues = extractFindings(outJson);
      rows.push([addressLike, toolName, issues.length.toString(), "ok"]);
      console.log(`🧪 ${addressLike}: ${issues.length} findings`);
    } catch (e) {
      rows.push([addressLike, toolName, "0", `error: ${e.message.slice(0, 100)}`]);
      console.warn(`⚠️  Scan failed for ${addressLike}: ${e.message}`);
    }
  }

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join(os.EOL);
  await fs.writeFile(SUMMARY_CSV, csv);

  console.log(`\n✅ Summary written to ${SUMMARY_CSV}`);
  console.log("🏁 Analysis complete.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}
