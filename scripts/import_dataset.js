// scripts/import_dataset.js
import fs from "fs-extra";
import path from "path";
import axios from "axios";
import extract from "extract-zip";
import chalk from "chalk";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../data/contracts/offline_seed");
const ZIP_PATH = path.join(__dirname, "../data/tmp_dataset.zip");

// Example dataset (SmartBugs curated Solidity contracts)
const DATASET_URL =
  "https://github.com/smartbugs/smartbugs-dataset/archive/refs/heads/master.zip";

async function importDataset() {
  console.log(chalk.cyanBright("\n=== Importing Verified Contracts Dataset ===\n"));
  fs.ensureDirSync(DATA_DIR);

  try {
    console.log(chalk.gray("⬇️  Downloading dataset..."));
    const response = await axios({
      url: DATASET_URL,
      method: "GET",
      responseType: "arraybuffer"
    });
    fs.writeFileSync(ZIP_PATH, response.data);

    console.log(chalk.gray("📦 Extracting dataset..."));
    await extract(ZIP_PATH, { dir: path.join(__dirname, "../data/") });

    console.log(chalk.gray("🧹 Organizing Solidity contracts..."));

    // Move all .sol files to data/contracts/offline_seed/
    const extractedDir = path.join(
      __dirname,
      "../data/smartbugs-dataset-master/dataset"
    );

    const allFiles = await fs.readdir(extractedDir);
    for (const subfolder of allFiles) {
      const subpath = path.join(extractedDir, subfolder);
      if ((await fs.stat(subpath)).isDirectory()) {
        const solFiles = fs.readdirSync(subpath).filter(f => f.endsWith(".sol"));
        for (const file of solFiles) {
          await fs.copy(
            path.join(subpath, file),
            path.join(DATA_DIR, `${subfolder}_${file}`)
          );
        }
      }
    }

    console.log(chalk.greenBright("\n✅ Dataset imported successfully!"));
    console.log(chalk.gray(`Contracts stored in: ${DATA_DIR}`));

    fs.removeSync(ZIP_PATH);
  } catch (err) {
    console.log(chalk.red(`❌ Failed to import dataset: ${err.message}`));
  }
}

importDataset();
