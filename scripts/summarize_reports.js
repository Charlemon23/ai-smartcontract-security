/**
 * summarize_reports.js
 * Generates a readable vulnerability summary from Slither JSON reports.
 */

import fs from "fs";
import path from "path";

const reportsDir = path.join(process.cwd(), "data/reports");
const outputFile = path.join(reportsDir, "summary_readable.txt");

function summarizeReports() {
  if (!fs.existsSync(reportsDir)) {
    console.error("❌ Reports directory not found:", reportsDir);
    return;
  }

  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith(".json") && f.startsWith("report_"));
  if (files.length === 0) {
    console.warn("⚠️ No report JSON files found in:", reportsDir);
    return;
  }

  let summaryText = `🧩 Vulnerability Summary (${files.length} Contracts)\n${"-".repeat(60)}\n`;
  console.log(summaryText);

  for (const file of files) {
    const reportPath = path.join(reportsDir, file);
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      const contractName = file.replace("report_", "").replace(".json", "");
      const results = report.results?.detectors || [];

      if (results.length === 0) {
        summaryText += `\n${contractName}.sol → ✅ No issues found\n`;
        console.log(`✅ ${contractName}.sol → No issues found`);
        continue;
      }

      summaryText += `\n${contractName}.sol → ${results.length} issues\n`;
      console.log(`\n${contractName}.sol → ${results.length} issues`);

      for (const det of results) {
        const title = det.check || det["check"];
        const severity = det["impact"] || "N/A";
        const elements = det["elements"] || [];
        const source = elements.length > 0 ? elements[0].source_mapping?.filename || "unknown" : "unknown";
        summaryText += `  • ${title} [Severity: ${severity}] (${path.basename(source)})\n`;
        console.log(`  • ${title} [Severity: ${severity}]`);
      }

    } catch (err) {
      console.error(`❌ Failed to parse ${file}:`, err.message);
    }
  }

  // Save summary to file
  fs.writeFileSync(outputFile, summaryText);
  console.log(`\n📝 Summary saved to: ${outputFile}`);
}

summarizeReports();
