/**
 * Summarizes Slither JSON reports into concise JSON + Markdown outputs.
 * Keeps full reports intact for reproducibility.
 */

const fs = require("fs-extra");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "../data/reports");
const SUMMARY_JSON = path.join(REPORTS_DIR, "summary.json");
const SUMMARY_MD = path.join(REPORTS_DIR, "summary.md");

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.warn(`⚠️ Could not parse ${filePath}:`, err.message);
    return null;
  }
}

function summarizeReport(data, filename) {
  if (!data || !data.results || !data.results.detectors) return null;

  const detectors = data.results.detectors;
  const issues = detectors.map(d => ({
    check: d.check || "Unknown",
    impact: d.impact || "Unknown",
    confidence: d.confidence || "N/A",
    description: d.description || "",
  }));

  // Count by severity
  const severityCount = issues.reduce((acc, i) => {
    acc[i.impact] = (acc[i.impact] || 0) + 1;
    return acc;
  }, {});

  return {
    file: filename,
    total_issues: issues.length,
    severity_breakdown: severityCount,
    example_issues: issues.slice(0, 3),
  };
}

async function main() {
  console.log("\n=== Summarizing Slither Reports ===");

  const allReports = fs
    .readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith("report_") && f.endsWith(".json"));

  if (allReports.length === 0) {
    console.log("⚠️ No JSON reports found to summarize.");
    return;
  }

  const summaryList = [];
  for (const f of allReports) {
    const filePath = path.join(REPORTS_DIR, f);
    const data = readJSON(filePath);
    const summary = summarizeReport(data, f);
    if (summary) summaryList.push(summary);
  }

  const summaryData = {
    timestamp: new Date().toISOString(),
    total_reports: summaryList.length,
    summaries: summaryList,
  };

  await fs.writeFile(SUMMARY_JSON, JSON.stringify(summaryData, null, 2));

  /* ---------- Markdown Report ---------- */
  let md = `# 🧠 Smart Contract Vulnerability Summary\n\n`;
  md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
  md += `**Total Reports:** ${summaryList.length}\n\n`;

  md += `| Contract | Total Issues | Severity (High/Medium/Low) |\n`;
  md += `|:--|:--:|:--:|\n`;

  for (const s of summaryList) {
    const sev = s.severity_breakdown;
    md += `| ${s.file.replace("report_", "").replace(".json", "")} | ${s.total_issues} | `;
    md += `${sev.High || 0}/${sev.Medium || 0}/${sev.Low || 0} |\n`;
  }

  md += `\n## 🔍 Example Issues\n`;

  for (const s of summaryList) {
    md += `\n### ${s.file.replace("report_", "").replace(".json", "")}\n`;
    if (s.example_issues.length === 0) {
      md += `*(No example issues found)*\n`;
      continue;
    }
    s.example_issues.forEach((i, idx) => {
      md += `**${idx + 1}. ${i.check}** — *${i.impact}* (${i.confidence})\n\n`;
      md += `${i.description.trim()}\n\n`;
    });
  }

  await fs.writeFile(SUMMARY_MD, md);
  console.log(`✅ Summary written to:\n  • ${SUMMARY_JSON}\n  • ${SUMMARY_MD}`);
  console.log(`📊 Contracts summarized: ${summaryList.length}`);
}

main().catch(err => {
  console.error("❌ Summary generation error:", err.message);
});
