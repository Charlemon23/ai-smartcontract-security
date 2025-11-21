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
