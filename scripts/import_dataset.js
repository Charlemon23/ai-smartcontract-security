/**
 * import_dataset.js
 * Downloads verified Solidity contracts from SmartBugs Dataset (GitHub)
 * and places them under data/contracts/imported/
 */

const fs = require("fs-extra");
const path = require("path");
const https = require("https");
const extract = require("extract-zip");

const ZIP_URL =
  "https://github.com/smartbugs/smartbugs-dataset/archive/refs/heads/master.zip";
const TMP_PATH = path.join(__dirname, "../tmp/smartbugs.zip");
const DEST_DIR = path.join(__dirname, "../data/contracts/imported");

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`⬇️  Downloading dataset...`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200)
        return reject(new Error("Download failed."));
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", reject);
  });
}

async function extractDataset() {
  console.log("📦 Extracting dataset...");
  await fs.ensureDir(DEST_DIR);
  await extract(TMP_PATH, { dir: DEST_DIR });
  console.log(`✅ Extracted to ${DEST_DIR}`);
}

(async () => {
  try {
    await fs.ensureDir(path.dirname(TMP_PATH));
    await download(ZIP_URL, TMP_PATH);
    await extractDataset();
    console.log("🎯 SmartBugs dataset ready for analysis.");
  } catch (err) {
    console.error("❌ Dataset import failed:", err.message);
  }
})();
