import fs from "fs-extra";
import path from "path";

const REPORTS_DIR = "data/reports";
const OUTPUT_FILE = path.join(REPORTS_DIR, "summary_readable.txt");

function classifySeverity(issue) {
  const text = issue.toLowerCase();
  if (text.includes("reentrancy") || text.includes("overflow") || text.includes("access control")) return "High";
  if (text.includes("front-running") || text.includes("unchecked") || text.includes("dos")) return "Medium";
  if (text.includes("visibility") || text.includes("unused") || text.includes("optimization")) return "Low";
  return "Informational";
}

function summarizeReports() {
  console.log("\n=== 🔍 Generating Enhanced Vulnerability Summary ===");

  const reports = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith(".json"));
  let summary = "";

  for (const reportFile of reports) {
    const filePath = path.join(REPORTS_DIR, reportFile);
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);

    const findings = parsed.results?.detectors || [];
    summary += `\n${parsed.source_mapping?.filename_short || reportFile} → ${findings.length} issues\n`;

    for (const f of findings) {
      const severity = classifySeverity(f.check || "");
      summary += `  • ${f.check} [Severity: ${severity}]\n`;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, summary, "utf8");
  console.log(`\n📝 Summary saved to: ${OUTPUT_FILE}`);
}

summarizeReports();
