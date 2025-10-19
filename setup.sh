#!/bin/bash
set -e

echo "==> Writing base configuration and source files..."

# ---------- Devcontainer ----------
mkdir -p .devcontainer
cat > .devcontainer/devcontainer.json <<'JSON'
{
  "name": "AI Smart Contract Security",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "postCreateCommand": "npm ci || npm i",
  "customizations": {
    "vscode": {
      "extensions": [
        "nomicfoundation.hardhat-solidity",
        "dbaeumer.vscode-eslint"
      ]
    }
  }
}
JSON

# ---------- CI workflow ----------
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'YML'
name: CI
on: [push, pull_request]
jobs:
  build-test-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci || npm i
      - run: npx hardhat compile
      - run: npm test --silent
      - run: node scanner/index.js --src contracts --out reports/ci --format both
      - uses: actions/upload-artifact@v4
        with:
          name: scan-report
          path: reports/ci
YML

# ---------- Basic gitignore ----------
cat > .gitignore <<'TXT'
node_modules
coverage
cache
artifacts
reports
.env
TXT

# ---------- Package.json ----------
cat > package.json <<'JSON'
{
  "name": "ai-smartcontract-security",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "scan": "node scanner/index.js --src contracts --out reports/local --format both"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "chai": "^4.4.1",
    "ethers": "^6.13.0",
    "hardhat": "^2.22.10",
    "jest": "^29.7.0",
    "solc": "^0.8.29"
  },
  "license": "MIT"
}
JSON

# ---------- Hardhat config ----------
cat > hardhat.config.js <<'JS'
require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: { hardhat: {} }
};
JS

# ---------- Jest ----------
cat > jest.config.js <<'JS'
module.exports = { testEnvironment: "node", testMatch: ["**/test/**/*.js"] };
JS

# ---------- Contracts ----------
mkdir -p contracts
cat > contracts/VulnerableBank.sol <<'SOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract VulnerableBank {
    mapping(address => uint256) public balances;
    function deposit() external payable { balances[msg.sender] += msg.value; }
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);
        balances[msg.sender] = 0;
    }
}
SOL

cat > contracts/SafeBank.sol <<'SOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract SafeBank {
    mapping(address => uint256) public balances;
    function deposit() external payable { balances[msg.sender] += msg.value; }
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0);
        balances[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }
}
SOL

# ---------- Simple test ----------
mkdir -p test
cat > test/bank.test.js <<'JS'
const { expect } = require("chai");
const { ethers } = require("hardhat");
describe("SafeBank", () => {
  it("deposits and withdraws safely", async () => {
    const [u] = await ethers.getSigners();
    const Bank = await ethers.getContractFactory("SafeBank");
    const bank = await Bank.deploy();
    await bank.waitForDeployment();
    await bank.connect(u).deposit({ value: ethers.parseEther("1") });
    expect(await bank.balances(u.address)).to.equal(ethers.parseEther("1"));
    await bank.connect(u).withdraw();
    expect(await bank.balances(u.address)).to.equal(0n);
  });
});
JS

# ---------- Scanner core ----------
mkdir -p scanner/utils scanner/rules
cat > scanner/utils/solc.js <<'JS'
import fs from "fs";
import path from "path";
import solc from "solc";
export function readSolidityFiles(srcDir) {
  const files = [];
  const walk = d => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (p.endsWith(".sol")) files.push(p);
    }
  };
  walk(srcDir);
  return files;
}
export function compileToAST(files) {
  const input = {
    language: "Solidity",
    sources: Object.fromEntries(
      files.map(fp => [path.relative(process.cwd(), fp), { content: fs.readFileSync(fp, "utf8") }])
    ),
    settings: { outputSelection: { "*": { "*": ["*"], "": ["ast"] } } }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors && output.errors.some(e => e.severity === "error")) {
    throw new Error(output.errors.map(e => e.formattedMessage).join("\\n"));
  }
  return Object.entries(output.sources).map(([file, obj]) => ({ file, ast: obj.ast }));
}
JS

cat > scanner/report.js <<'JS'
import fs from "fs";
import path from "path";
export function writeReports(findings, outDir, format) {
  fs.mkdirSync(outDir, { recursive: true });
  const json = JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2);
  if (format === "json" || format === "both") fs.writeFileSync(path.join(outDir,"report.json"), json);
  if (format === "md" || format === "both") {
    const lines = ["# Scan Report", "Generated: " + new Date().toISOString(), ""];
    if (!findings.length) lines.push("✅ No issues found.");
    else {
      lines.push("|Severity|Rule|File:Lines|Message|","|---|---|---|---|");
      for (const f of findings)
        lines.push(`|${f.severity}|${f.rule}|${f.location}|${f.message}|`);
    }
    fs.writeFileSync(path.join(outDir,"report.md"), lines.join("\\n"));
  }
}
JS

cat > scanner/rules/reentrancy.js <<'JS'
export default function reentrancyRule({ file, source }) {
  const findings=[];const lines=source.split(/\\r?\\n/);let func=null;
  lines.forEach((ln,idx)=>{
    if(/function\\s+\\w+\\s*\\(/.test(ln)) func={start:idx+1,ext:false,write:false};
    if(func){
      if(/\\.(call|delegatecall|send|transfer)\\s*\\{?value?/.test(ln)) func.ext=true;
      if(func.ext && /=\\s*.+balances/.test(ln)) func.write=true;
      if(/}/.test(ln)){ if(func.ext&&func.write) findings.push({rule:"REENTRANCY",severity:"HIGH",message:"External call before state update",location:`${file}:${func.start}-${idx+1}`}); func=null;}
    }
  });
  return findings;
}
JS

cat > scanner/index.js <<'JS'
#!/usr/bin/env node
import fs from "fs";
import { readSolidityFiles, compileToAST } from "./utils/solc.js";
import reentrancy from "./rules/reentrancy.js";
import { writeReports } from "./report.js";
const rules=[reentrancy];
function run(){
  const src="contracts",out="reports/local",format="both";
  const files=readSolidityFiles(src);
  compileToAST(files);
  const findings=[];
  for(const file of files){
    const source=fs.readFileSync(file,"utf8");
    for(const rule of rules) for(const f of rule({file,source})) findings.push(f);
  }
  writeReports(findings,out,format);
  console.log("Scan complete",findings.length,"issues");
}
run();
JS

chmod +x scanner/index.js
echo "✅ Files written. Installing npm packages..."
npm install
echo "✅ Done! You can now run:"
echo "   npx hardhat compile"
echo "   npm test"
echo "   npm run scan"
