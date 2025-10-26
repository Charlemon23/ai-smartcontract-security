import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";

const CONTRACTS_DIR = "data/contracts/offline_seed";
const REPORTS_DIR = "data/reports/oyente";

export async function runOyente() {
  fs.ensureDirSync(REPORTS_DIR);
  const sols = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith(".sol"));
  for (const file of sols) {
    const input = path.join(CONTRACTS_DIR, file);
    const output = path.join(REPORTS_DIR, `oyente_${file.replace(".sol", ".json")}`);
    console.log(`🔍 Oyente analyzing ${file}...`);
    try {
      execSync(`python3 -m oyente ${input} --json > ${output}`, { stdio: "inherit" });
    } catch {
      console.warn(`⚠️ Oyente failed on ${file}`);
    }
  }
  console.log("✅ Oyente analysis complete.");
}
