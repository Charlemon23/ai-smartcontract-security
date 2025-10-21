// scripts/run_pipeline.js
const path = require("path");
const { spawn } = require("child_process");

function runNode(script) {
  return new Promise((resolve, reject) => {
    const p = spawn("node", [script], { stdio: "inherit" });
    p.on("close", code => code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`)));
  });
}

(async () => {
  const t0 = Date.now();
  console.log(`\n=== AI Smart Contract Security Testbed: Live Pipeline ===`);
  console.log(`[${new Date().toISOString()}] Starting...`);

  try {
    await runNode(path.join(__dirname, "..", "data_pipeline", "fetch_contracts.js"));
    console.log(`\n--- Fetch complete. Starting analysis ---\n`);
    await runNode(path.join(__dirname, "..", "scanner", "analyze_contracts.js"));
    const mins = ((Date.now() - t0)/60000).toFixed(2);
    console.log(`\n🎉 Pipeline complete in ${mins} min.`);
    console.log(`Reports: data/reports/ | Contracts: data/contracts/`);
  } catch (e) {
    console.error(`Pipeline error: ${e.message}`);
    process.exit(1);
  }
})();
