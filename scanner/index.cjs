#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { readSolidityFiles, compileToAST } = require("./utils/solc.cjs");
const reentrancy = require("./rules/reentrancy.cjs");
const { writeReports } = require("./report.cjs");

const rules = [reentrancy];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { src: "contracts", out: "reports/local", format: "both" };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--src") opts.src = args[++i];
    else if (a === "--out") opts.out = args[++i];
    else if (a === "--format") opts.format = args[++i];
  }
  return opts;
}

function run() {
  const { src, out, format } = parseArgs();

  const files = readSolidityFiles(src);
  if (files.length === 0) {
    console.error(`No .sol files found under ${src}`);
    process.exit(2);
  }

  compileToAST(files);

  const findings = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const rule of rules) {
      for (const f of rule({ file, source })) findings.push(f);
    }
  }

  writeReports(findings, out, format);

  const counts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});
  console.log("Scan complete:", counts, `(${findings.length} findings)`);
  console.log(`Reports written to ${out}`);
  process.exit(findings.length ? 1 : 0);
}

run();
