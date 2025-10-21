// scripts/run_pipeline.js

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { execSync } = require("child_process");
const path = require("path");

console.log("=== AI Smart Contract Security Testbed: Live Pipeline ===");
console.log(`[${new Date().toISOString()}] Starting...\n`);

console.log("Loaded environment variables:");
console.log({
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY ? "✅ Loaded" : "❌ Missing",
  BLOCK_WINDOW: process.env.BLOCK_WINDOW,
  ETHERSCAN_SLEEP_MS: process.env.ETHERSCAN_SLEEP_MS
});

try {
  // Step 1: Fetch contracts
  console.log("\n--- Fetching verified contracts ---");
  execSync(`node ${path.join(__dirname, "fetch_contracts.js")}`, { stdio: "inherit" });

  // Step 2: Analyze contracts
  console.log("\n--- Fetch complete. Starting analysis ---");
  execSync(`node ${path.join(__dirname, "../scanner/analyze_contracts.js")}`, { stdio: "inherit" });

  console.log("\n🎉 Pipeline complete.\n");
} catch (err) {
  console.error("Pipeline error:", err.message);
  process.exit(1);
}
