import fs from "fs-extra";
import path from "path";

const REPORT_PATHS = [
  "data/reports/slither",
  "data/reports/mythril",
  "data/reports/oyente"
];

const OUT_FILE = "data/reports/comparative_summary.csv";

function loadFindings(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .flatMap(f => {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f)));
        const issues = j.results?.detectors || j.issues || [];
        return issues.map(i => ({
          contract: f.replace(/^.*_/, "").replace(/\.json$/, ""),
          tool: path.basename(dir),
          title: i.check || i.title || "unknown"
        }));
      } catch { return []; }
    });
}

function aggregate() {
  const all = REPORT_PATHS.flatMap(loadFindings);
  const grouped = {};
  for (const a of all) {
    const key = `${a.contract}::${a.title}`;
    grouped[key] = grouped[key] || { contract: a.contract, title: a.title, tools: [] };
    grouped[key].tools.push(a.tool);
  }

  const csv = ["Contract,Vulnerability,ToolsDetected"].concat(
    Object.values(grouped).map(g => `${g.contract},${g.title},"${g.tools.join(",")}"`)
  ).join("\n");

  fs.writeFileSync(OUT_FILE, csv);
  console.log(`✅ Comparative summary saved to ${OUT_FILE}`);
}

aggregate();
