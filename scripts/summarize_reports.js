// scripts/summarize_reports.js
import fs from "fs-extra";
import path from "path";

const REPORTS_DIR = "data/reports";
const OUTPUT = path.join(REPORTS_DIR, "summary_readable.txt");

function summarize() {
  const subdirs = fs.readdirSync(REPORTS_DIR).filter(f => fs.statSync(path.join(REPORTS_DIR, f)).isDirectory());
  let summary = `🧩 Smart Contract Vulnerability Summary\n${"-".repeat(60)}\n`;

  for (const toolDir of subdirs) {
    const fullPath = path.join(REPORTS_DIR, toolDir);
    const files = fs.readdirSync(fullPath).filter(f => f.endsWith(".json"));
    summary += `\n=== ${toolDir.toUpperCase()} ===\n`;
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(fullPath, file), "utf8"));
        const issues = data.results?.detectors || data.issues || [];
        summary += `${file}: ${issues.length} issue(s)\n`;
        for (const issue of issues.slice(0, 3)) {
          summary += `  • ${issue.check || issue.title || "unknown"}\n`;
        }
      } catch {
        summary += `${file}: ⚠️ Invalid JSON\n`;
      }
    }
  }

  fs.writeFileSync(OUTPUT, summary, "utf8");
  console.log(summary);
  console.log(`\n📝 Summary saved at ${OUTPUT}`);
}

summarize();
