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
const TMP_PATH = path.join(__dirname, "../data/tmp_dataset.zip");

// ✅ Public, no-auth mirror (collection of verified Solidity contracts)
const DATASET_URL =
  "https://github.com/Charlemon23/solidity-dataset/archive/refs/heads/main.zip";

async function importDataset() {
  console.log(chalk.cyanBright("\n=== Importing Verified Contracts Dataset ===\n"));
  fs.ensureDirSync(DATA_DIR);

  try {
    console.log(chalk.gray("⬇️  Downloading verified dataset (~10 MB)..."));
    const response = await axios({
      url: DATASET_URL,
      method: "GET",
      responseType: "arraybuffer",
      timeout: 60000
    });
    fs.writeFileSync(TMP_PATH, response.data);

    console.log(chalk.gray("📦 Extracting dataset..."));
    await extract(TMP_PATH, { dir: path.join(__dirname, "../data/") });

    console.log(chalk.gray("🧹 Organizing Solidity contracts..."));

    // Move all .sol files to the offline_seed folder
    const extractedDir = path.join(__dirname, "../data/solidity-dataset-main");
    const allFiles = await fs.readdir(extractedDir);

    for (const file of allFiles) {
      if (file.endsWith(".sol")) {
        await fs.copy(path.join(extractedDir, file), path.join(DATA_DIR, file));
      }
    }

    console.log(chalk.greenBright("\n✅ Dataset imported successfully!"));
    console.log(chalk.gray(`Contracts stored in: ${DATA_DIR}`));

    fs.removeSync(TMP_PATH);
  } catch (err) {
    console.log(chalk.red(`❌ Failed to import dataset: ${err.message}`));
    console.log(chalk.yellow("\nIf this persists, you can manually add .sol files into:"));
    console.log(chalk.blueBright(DATA_DIR));
  }
}

importDataset();
