export default function lowLevelCallRule({ file, source }) {
  const findings = [];
  const rx = /\.(call|delegatecall|callcode)\s*\{?value?/g;
  let m;
  while ((m = rx.exec(source))) {
    findings.push({
      rule: "LOW_LEVEL_CALL",
      severity: "MEDIUM",
      message: `Low-level ${m[1]} used; prefer transfer/send or checks with reentrancy guards.`,
      location: `${file}:~${source.slice(0, m.index).split(/\r?\n/).length}`
    });
  }
  return findings;
}
