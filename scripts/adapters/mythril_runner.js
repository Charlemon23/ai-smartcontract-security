import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";

const CONTRACTS_DIR = "data/contracts/offline_seed";
const REPORTS_DIR = "data/reports/mythril";

export async function runMythril() {
  fs.ensureDirSync(REPORTS_DIR);
  const sols = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith(".sol"));
  for (const file of sols) {
    const input = path.join(CONTRACTS_DIR, file);
    const output = path.join(REPORTS_DIR, `mythril_${file.replace(".sol", ".json")}`);
    console.log(`🔍 Mythril analyzing ${file}...`);
    try {
      execSync(`myth analyze ${input} --execution-timeout 60 --outform json > ${output}`, { stdio: "inherit" });
    } catch {
      console.warn(`⚠️ Mythril failed on ${file}`);
    }
  }
  console.log("✅ Mythril analysis complete.");
}
