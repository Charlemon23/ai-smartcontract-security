import { createRequire } from "module";
const require = createRequire(import.meta.url);
const glob = require("glob");
const path = require("path");
const { exec } = require("child_process");
import fs from "fs-extra";
import chalk from "chalk";

const MAX_PARALLEL = 3;

function pExec(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ err, stdout, stderr });
    });
  });
}

async function runOne(file) {
  const cmd = `npx -y solhint -f json "${file}"`;
  const { err, stdout, stderr } = await pExec(cmd);
  if (err && !stdout) {
    return { file, issues: [], error: (stderr || err.message || "Solhint failed").trim() };
  }
  let parsed = [];
  try {
    parsed = JSON.parse(stdout || "[]");
  } catch {
    // Some versions emit JSON array or {reports:[]}
    try {
      const alt = JSON.parse(stdout || "{}");
      parsed = Array.isArray(alt) ? alt : (alt.reports || []);
    } catch {}
  }
  return { file, issues: parsed };
}

export async function runSolhintAnalysis(globs) {
  console.log(chalk.magenta("✅ Solhint Analyzer Ready"));
  const files = globs.flatMap(g => glob.sync(g));
  const unique = Array.from(new Set(files)).filter(f => f.endsWith(".sol"));

  if (!unique.length) {
    console.log(chalk.yellow("⚠️  No Solidity files for Solhint."));
    return [];
  }

  const results = [];
  const queue = unique.slice();
  const workers = Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, async function worker() {
    while (queue.length) {
      const file = queue.shift();
      const res = await runOne(file);
      results.push(res);
      const issueCount = Array.isArray(res.issues) ? res.issues.length : 0;
      console.log(chalk.green(`  ◦ Solhint ${path.basename(file)} → ${issueCount} issue(s)`));
      // Small delay to be gentle in Codespaces
      await new Promise(r => setTimeout(r, 50));
    }
  }).map(fn => fn());

  await Promise.all(workers);

  // store per-file JSON if you want (optional)
  const outDir = path.join(process.cwd(), "data/reports/solhint");
  await fs.ensureDir(outDir);
  for (const r of results) {
    const name = path.basename(r.file).replace(/\.sol$/, "");
    await fs.writeJSON(path.join(outDir, `solhint_${name}.json`), r.issues, { spaces: 2 });
  }

  return results;
}
