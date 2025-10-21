// scanner/analyze_contracts.js
/* Scans all sources in data/contracts/ with Slither (preferred) or Mythril.
 * Outputs JSON reports to data/reports/, plus a summary CSV.
 */

const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");
const os = require("os");

const CONTRACTS_DIR = path.join(__dirname, "..", "data", "contracts");
const REPORTS_DIR   = path.join(__dirname, "..", "data", "reports");
const LOGS_DIR      = path.join(__dirname, "..", "data", "logs");
const SUMMARY_CSV   = path.join(REPORTS_DIR, "summary.csv");

async function which(bin) {
  return new Promise(resolve => {
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

async function scanWithSlither(targetPath, outJsonPath) {
  const cmd = `slither "${targetPath}" --json "${outJsonPath}" --no-fail-pedantic --solc-remaps @=./node_modules/@`;
  await run(cmd, path.dirname(targetPath));
}

async function scanWithMythril(targetPath, outJsonPath) {
  // Mythril prefers a single file; for multi-file dirs we point at one .sol or run per file
  const cmd = `myth analyze "${targetPath}" --execution-timeout 60 --max-depth 30 -o json > "${outJsonPath}"`;
  await run(cmd, path.dirname(targetPath));
}

function findContracts() {
  // returns a list of "targets": either .sol files OR directories (multi-file projects)
  const items = fs.readdirSync(CONTRACTS_DIR);
  const targets = [];
  for (const name of items) {
    const full = path.join(CONTRACTS_DIR, name);
    const stat = fs.statSync(full);
    if (stat.isFile() && name.endsWith(".sol")) targets.push(full);
    else if (stat.isDirectory()) {
      // choose a main file if exists, else scan the directory path (Slither supports dirs)
      const candidates = fs.readdirSync(full).filter(f => f.endsWith(".sol"));
      const main = candidates.find(f => /(?<!test)\.sol$/i.test(f)) || candidates[0];
      if (main) targets.push(path.join(full, main));
      else targets.push(full); // last resort
    }
  }
  return targets;
}

function extractFindings(reportPath) {
  // Very loose parser to produce a one-line CSV per report
  try {
    const raw = fs.readFileSync(reportPath, "utf-8");
    const data = JSON.parse(raw);
    let issues = [];
    // Slither JSON shape
    if (data && data.results && data.results.detectors) {
      issues = data.results.detectors.map(d => ({
        check: d.check,
        impact: d.impact || "",
        confidence: d.confidence || "",
      }));
    }
    // Mythril JSON shape (single object or array)
    if (Array.isArray(data)) {
      issues = data.map(i => ({
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

async function main() {
  await fs.ensureDir(REPORTS_DIR);
  await fs.ensureDir(LOGS_DIR);

  const slitherBin = await which("slither");
  const mythrilBin = await which("myth");
  const useSlither = !!slitherBin;

  const targets = findContracts();
  if (!targets.length) {
    console.log("No contracts found in data/contracts/. Run the fetcher first.");
    return;
  }

  console.log(`Scanner: using ${useSlither ? "Slither" : mythrilBin ? "Mythril" : "NONE"}`);
  if (!useSlither && !mythrilBin) {
    console.error("Neither Slither nor Mythril found on PATH.");
    process.exit(2);
  }

  const rows = [["address_or_path","tool","issues_count","notes"]];

  for (const target of targets) {
    const addressLike = path.basename(target).replace(".sol","").toLowerCase();
    const outJson = path.join(REPORTS_DIR, `${addressLike}.json`);
    try {
      if (useSlither) await scanWithSlither(target, outJson);
      else await scanWithMythril(target, outJson);

      const issues = extractFindings(outJson);
      rows.push([addressLike, useSlither ? "slither" : "mythril", issues.length.toString(), "ok"]);
      console.log(`🧪 ${addressLike}: ${issues.length} findings`);
    } catch (e) {
      rows.push([addressLike, useSlither ? "slither" : "mythril", "0", `error: ${e.message.slice(0,120)}`]);
      console.warn(`Scan failed for ${addressLike}: ${e.message}`);
      // keep going
    }
  }

  // write CSV
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join(os.EOL);
  await fs.writeFile(SUMMARY_CSV, csv);
  console.log(`\n✅ Summary written: ${SUMMARY_CSV}`);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
