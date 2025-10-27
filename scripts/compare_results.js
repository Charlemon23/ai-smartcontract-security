// scripts/compare_results.js
import fs from "fs-extra";
import path from "path";

const BASE = "data/reports";
const OUT = path.join(BASE, "comparative_summary.csv");

function loadFindings(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .flatMap(f => {
      const json = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const detectors = json.results?.detectors || json.issues || [];
      return detectors.map(d => ({
        contract: f.replace(/^.*_/, "").replace(/\.json$/, ""),
        vuln: d.check || d.title || "unknown",
        tool: path.basename(dir),
      }));
    });
}

function aggregate() {
  const slither = loadFindings(path.join(BASE, "slither"));
  const mythril = loadFindings(path.join(BASE, "mythril"));
  const oyente = loadFindings(path.join(BASE, "oyente"));

  const all = [...slither, ...mythril, ...oyente];
  const grouped = {};

  for (const item of all) {
    const key = `${item.contract}::${item.vuln}`;
    if (!grouped[key]) grouped[key] = { contract: item.contract, vuln: item.vuln, tools: [] };
    grouped[key].tools.push(item.tool);
  }

  const csv = ["Contract,Vulnerability,ToolsDetected"].concat(
    Object.values(grouped).map(v => `${v.contract},${v.vuln},"${v.tools.join(",")}"`)
  );

  fs.writeFileSync(OUT, csv.join("\n"));
  console.log(`✅ Comparative report generated: ${OUT}`);
}

aggregate();
