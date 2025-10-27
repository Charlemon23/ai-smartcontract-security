// scripts/import_dataset.js
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
    console.log(`✅ Using existing local dataset (${local.length} contracts).`);
    return;
  }

  console.log("🌐 Downloading SmartBugs dataset...");
  try {
    const response = await fetch(DATASET_URL);
    if (!response.ok) throw new Error(`Failed to fetch SmartBugs dataset: ${response.status}`);
    await response.body.pipe(unzipper.Extract({ path: DEST_DIR })).promise();
    console.log("✅ SmartBugs dataset successfully downloaded and extracted.");
  } catch (err) {
    console.error("⚠️ Online dataset unavailable. Using local fallback set.");
    const fallback = {
      "SafeBank.sol": `// SPDX-License-Identifier: MIT
      pragma solidity ^0.8.0;
      contract SafeBank {
        mapping(address => uint) public balances;
        function deposit() public payable { balances[msg.sender] += msg.value; }
        function withdraw(uint amount) public {
          require(balances[msg.sender] >= amount, "Insufficient");
          balances[msg.sender] -= amount;
          payable(msg.sender).transfer(amount);
        }
      }`,
    };
    for (const [name, code] of Object.entries(fallback)) {
      fs.writeFileSync(`${DEST_DIR}/${name}`, code, "utf8");
    }
    console.log("✅ Fallback dataset written locally.");
  }
}

importDataset();
