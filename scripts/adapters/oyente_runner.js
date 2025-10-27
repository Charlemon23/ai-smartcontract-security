// scripts/adapters/oyente_runner.js
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";

export function runOyente(CONTRACTS_DIR, REPORTS_DIR) {
  console.log("\n🔍 Oyente Analyzer Started");
  const outDir = path.join(REPORTS_DIR, "oyente");
  fs.ensureDirSync(outDir);
  const contracts = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith(".sol"));
  for (const file of contracts) {
    const input = path.join(CONTRACTS_DIR, file);
    const output = path.join(outDir, `oyente_${file.replace(".sol", ".json")}`);
    try {
      execSync(`python3 -m oyente "${input}" --json > "${output}"`, { stdio: "inherit" });
    } catch (err) {
      console.error(`⚠️ Oyente failed on ${file}: ${err.message}`);
    }
  }
  console.log("✅ Oyente analysis complete.");
}
