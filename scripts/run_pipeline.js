import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { execSync } from "child_process";
import { runSolhintAnalysis } from "./analyzers/solhint.js";
import { runSuryaAnalysis } from "./analyzers/surya.js";
import { autoSeedAndFetch } from "./utils/auto_seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ROOT = path.resolve(path.join(__dirname, ".."));
const CONTRACTS_DIR = path.join(ROOT, "data/contracts");
const OFFLINE_DIR = path.join(CONTRACTS_DIR, "offline_seed");
const ONLINE_DIR = path.join(CONTRACTS_DIR, "verified");
const REPORTS_DIR = path.join(ROOT, "data/reports");
const LOG_DIR = path.join(ROOT, "data/logs");
const LOG_FILE = path.join(LOG_DIR, "pipeline.log");

async function ensureDirs() {
  await fs.ensureDir(OFFLINE_DIR);
  await fs.ensureDir(ONLINE_DIR);
  await fs.ensureDir(REPORTS_DIR);
  await fs.ensureDir(LOG_DIR);
}

function writeLog(line) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${line}\n`);
}

function haveSolFiles() {
  const all = fs.readdirSync(OFFLINE_DIR).filter(f => f.endsWith(".sol")).length
    + fs.readdirSync(ONLINE_DIR).filter(f => f.endsWith(".sol")).length;
  return all > 0;
}

function allContractGlobs() {
  return [path.join(OFFLINE_DIR, "**/*.sol"), path.join(ONLINE_DIR, "**/*.sol")];
}

function tryCmd(cmd) {
  try { return execSync(cmd, { stdio: "pipe", encoding: "utf8" }).trim(); }
  catch { return null; }
}

async function ensureTools() {
  const solhintOk = !!tryCmd("npx -y solhint --version");
  const suryaOk = !!tryCmd("npx -y surya --help");

  if (!solhintOk || !suryaOk) {
    console.log(chalk.yellow("⬇️  Installing missing analyzers (Solhint/Surya)…"));
    writeLog("Installing analyzers via npm…");
    // Use legacy peer deps to avoid resolver issues in Codespaces
    tryCmd("npm install solhint surya --legacy-peer-deps");
  }

  const solhintV = tryCmd("npx -y solhint --version") || "unknown";
  const suryaV = tryCmd("npx -y surya --version") || "unknown";
  writeLog(`Solhint: ${solhintV} | Surya: ${suryaV}`);
}

async function rotateReportsKeepLast5() {
  await fs.ensureDir(REPORTS_DIR);
  const entries = (await fs.readdir(REPORTS_DIR))
    .filter(f => f.startsWith("summary-") || f === "summary.json" || f === "summary_readable.txt");
  if (!entries.length) return;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(REPORTS_DIR, `archive-${stamp}`);
  await fs.ensureDir(backupDir);

  for (const f of entries) {
    const src = path.join(REPORTS_DIR, f);
    if (fs.existsSync(src)) await fs.move(src, path.join(backupDir, f));
  }

  // Trim to last 5 archives
  const archives = (await fs.readdir(REPORTS_DIR)).filter(f => f.startsWith("archive-")).sort();
  while (archives.length > 5) {
    const old = archives.shift();
    await fs.remove(path.join(REPORTS_DIR, old));
  }
}

async function buildReadableSummary(summary) {
  const out = [];
  out.push("=== Smart Contract Security Summary (Automated) ===");
  out.push(`Timestamp: ${new Date().toISOString()}`);
  out.push("");

  const printTool = (label, results, mapper) => {
    out.push(`## ${label}`);
    if (!Array.isArray(results) || results.length === 0) {
      out.push("  (no results)");
      out.push("");
      return;
    }
    for (const r of results) {
      out.push(`- ${path.basename(r.file || "unknown")}`);
      for (const line of mapper(r)) out.push(`  ${line}`);
    }
    out.push("");
  };

  printTool("Solhint", summary.solhint, (r) => {
    const issues = Array.isArray(r.issues) ? r.issues : r.issues?.reports || [];
    const n = Array.isArray(issues) ? issues.length : 0;
    return [`Issues: ${n}`, ...(issues?.slice?.(0, 3) || []).map(i => `• ${i.ruleId || "rule"}: ${(i.message || "").trim()}`)];
  });

  printTool("Surya", summary.surya, (r) => {
    const firstLine = (r.summary || "").split("\n")[0] || "(ok)";
    return [`Summary: ${firstLine}`];
  });

  return out.join("\n");
}

async function main() {
  console.log(chalk.cyan.bold("\n=== AI Smart Contract Security Testbed — Automated JS Pipeline ==="));
  writeLog("----- RUN START -----");

  await ensureDirs();
  await ensureTools();

  // Auto-seed and (if online) fetch verified contracts
  await autoSeedAndFetch({ OFFLINE_DIR, ONLINE_DIR, log: writeLog });

  // If still no contracts, bail gracefully
  if (!haveSolFiles()) {
    console.log(chalk.yellow("⚠️  No Solidity files found after auto-seed/fetch. Nothing to analyze."));
    writeLog("No .sol files; exiting.");
    return;
  }

  // Rotate old summary files
  await rotateReportsKeepLast5();

  console.log(chalk.blueBright("\n🔹 Running analyzers in parallel..."));
  writeLog("Analyzers start");

  // Run in parallel (bounded concurrency inside analyzers)
  const [solRes, surRes] = await Promise.all([
    runSolhintAnalysis(allContractGlobs()),
    runSuryaAnalysis(allContractGlobs())
  ]);

  const summary = {
    timestamp: new Date().toISOString(),
    solhint: solRes,
    surya: surRes
  };

  await fs.writeJSON(path.join(REPORTS_DIR, "summary.json"), summary, { spaces: 2 });

  const txt = await buildReadableSummary(summary);
  await fs.writeFile(path.join(REPORTS_DIR, "summary_readable.txt"), txt);

  console.log(chalk.green("\n✅ Pipeline complete."));
  console.log(`📁 Reports saved in: ${REPORTS_DIR}`);
  writeLog("RUN OK");
}

main().catch(err => {
  console.error(chalk.red("❌ Pipeline failed"), err);
  writeLog(`ERROR: ${err?.message || err}`);
  process.exit(1);
});
