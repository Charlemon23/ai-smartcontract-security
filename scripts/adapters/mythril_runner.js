// scripts/adapters/mythril_runner.js
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";

export function runMythril(CONTRACTS_DIR, REPORTS_DIR) {
  console.log("\n🔍 Mythril Analyzer Started");
  const outDir = path.join(REPORTS_DIR, "mythril");
  fs.ensureDirSync(outDir);
  const contracts = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith(".sol"));
  for (const file of contracts) {
    const input = path.join(CONTRACTS_DIR, file);
    const output = path.join(outDir, `mythril_${file.replace(".sol", ".json")}`);
    try {
      execSync(`myth analyze "${input}" --execution-timeout 60 --outform json > "${output}"`, {
        stdio: "inherit",
      });
    } catch (err) {
      console.error(`⚠️ Mythril failed on ${file}: ${err.message}`);
    }
  }
  console.log("✅ Mythril analysis complete.");
}
