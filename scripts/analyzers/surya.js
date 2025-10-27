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
    exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ err, stdout, stderr });
    });
  });
}

async function runOne(file) {
  const cmd = `npx -y surya describe "${file}"`;
  const { err, stdout, stderr } = await pExec(cmd);
  if (err && !stdout) {
    return { file, summary: (stderr || err.message || "Surya failed").trim() };
  }
  return { file, summary: stdout || "(no output)" };
}

export async function runSuryaAnalysis(globs) {
  console.log(chalk.magenta("✅ Surya Analyzer Ready"));
  const files = globs.flatMap(g => glob.sync(g));
  const unique = Array.from(new Set(files)).filter(f => f.endsWith(".sol"));

  if (!unique.length) {
    console.log(chalk.yellow("⚠️  No Solidity files for Surya."));
    return [];
  }

  const results = [];
  const queue = unique.slice();
  const workers = Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, async function worker() {
    while (queue.length) {
      const file = queue.shift();
      const res = await runOne(file);
      results.push(res);
      console.log(chalk.green(`  ◦ Surya ${path.basename(file)} → described`));
      await new Promise(r => setTimeout(r, 50));
    }
  }).map(fn => fn());

  await Promise.all(workers);

  // store per-file describe output (optional)
  const outDir = path.join(process.cwd(), "data/reports/surya");
  await fs.ensureDir(outDir);
  for (const r of results) {
    const name = path.basename(r.file).replace(/\.sol$/, "");
    await fs.writeFile(path.join(outDir, `surya_${name}_describe.txt`), r.summary || "");
  }

  return results;
}
