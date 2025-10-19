export default function timestampRule({ file, source }) {
  const findings = [];
  const rx = /block\.(timestamp|number)/g;
  let m;
  while ((m = rx.exec(source))) {
    findings.push({
      rule: "TIMESTAMP_DEPENDENCE",
      severity: "LOW",
      message: "Contract relies on block timestamp/number which can be miner-influenced.",
      location: `${file}:~${source.slice(0, m.index).split(/\r?\n/).length}`
    });
  }
  return findings;
}
