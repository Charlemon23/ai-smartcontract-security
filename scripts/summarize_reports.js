// scripts/summarize_reports.js
import fs from "fs";
import path from "path";

const REPORTS_DIR = "data/reports";
const OUT = path.join(REPORTS_DIR, "summary_readable.txt");

function summarize() {
  if (!fs.existsSync(REPORTS_DIR)) {
    console.error("❌ Reports directory not found:", REPORTS_DIR);
    return;
  }
  const files = fs.readdirSync(REPORTS_DIR).filter(f => f.startsWith("report_") && f.endsWith(".json"));

  let text = `🧩 Vulnerability Summary (${files.length} contracts)\n${"-".repeat(60)}\n`;

  for (const f of files) {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), "utf8"));
      const det = json?.results?.detectors || [];
      const name = f.replace(/^report_/, "").replace(/\.json$/, "");
      text += `\n${name}.sol → ${det.length} issue(s)\n`;
      for (const d of det) {
        const check = d.check || "unknown";
        const impact = d.impact || "N/A";
        text += `  • ${check} [${impact}]\n`;
      }
    } catch (e) {
      text += `\n${f} → ⚠️ could not parse JSON\n`;
    }
  }

  fs.writeFileSync(OUT, text);
  console.log(text);
  console.log(`\n📝 Summary saved to: ${OUT}`);
}

summarize();