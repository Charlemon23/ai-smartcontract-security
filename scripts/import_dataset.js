import fs from "fs-extra";
import fetch from "node-fetch";
import unzipper from "unzipper";

const DATASET_URL =
  "https://huggingface.co/datasets/SirCornflakes/smartbugs-solidity-dataset/resolve/main/smartbugs-dataset.zip";
const DEST_DIR = "data/contracts/offline_seed";

async function importDataset() {
  fs.ensureDirSync(DEST_DIR);
  const local = fs.readdirSync(DEST_DIR).filter(f => f.endsWith(".sol"));
  if (local.length > 0) {
    console.log(`✅ Using existing dataset (${local.length} files).`);
    return;
  }
  console.log("🌐 Downloading SmartBugs dataset...");
  try {
    const r = await fetch(DATASET_URL);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await r.body.pipe(unzipper.Extract({ path: DEST_DIR })).promise();
    console.log("✅ SmartBugs dataset extracted successfully.");
  } catch (e) {
    console.error("⚠️ Failed to fetch SmartBugs dataset:", e.message);
  }
}

importDataset();
