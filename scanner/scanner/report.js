import fs from "node:fs";
import path from "node:path";

export function toJSON(findings) {
  return JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2);
}

export function toMarkdown(findings) {
  const lines = [];
  lines.push(`# Scan Report`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  if (findings.length === 0) {
    lines.push("✅ No issues found.");
  } else {
    lines.push("| Severity | Rule | File:Lines | Message |");
    lines.push("|---|---|---|---|");
    for (const f of findings) {
      lines.push(`| ${f.severity} | ${f.rule} | ${f.location} | ${f.message} |`);
    }
  }
  return lines.join("\n");
}

export function writeReports(findings, outDir, format) {
  fs.mkdirSync(outDir, { recursive: true });
  if (format === "json" || format === "both") {
    fs.writeFileSync(path.join(outDir, "report.json"), toJSON(findings));
  }
  if (format === "md" || format === "both") {
    fs.writeFileSync(path.join(outDir, "report.md"), toMarkdown(findings));
  }
}
