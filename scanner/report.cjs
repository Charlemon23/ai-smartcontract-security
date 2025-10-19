const fs = require("fs");
const path = require("path");

function writeReports(findings, outDir, format) {
  fs.mkdirSync(outDir, { recursive: true });
  const json = JSON.stringify(
    { generatedAt: new Date().toISOString(), findings },
    null,
    2
  );
  if (format === "json" || format === "both")
    fs.writeFileSync(path.join(outDir, "report.json"), json);
  if (format === "md" || format === "both") {
    const lines = [
      "# Scan Report",
      "Generated: " + new Date().toISOString(),
      "",
    ];
    if (!findings.length) lines.push("✅ No issues found.");
    else {
      lines.push("| Severity | Rule | File:Lines | Message |");
      lines.push("|---|---|---|---|");
      for (const f of findings)
        lines.push(
          `| ${f.severity} | ${f.rule} | ${f.location} | ${f.message} |`
        );
    }
    fs.writeFileSync(path.join(outDir, "report.md"), lines.join("\n"));
  }
}

module.exports = { writeReports };
