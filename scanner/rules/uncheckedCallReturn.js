export default function uncheckedCallReturnRule({ file, source }) {
  const findings = [];
  // Match ".call{...}(...)" not assigned to a bool or not checked
  const rx = /\.call\s*\{[^}]*\}\s*\([^)]*\)\s*;/.g;
  let m;
  while ((m = rx.exec(source))) {
    findings.push({
      rule: "UNCHECKED_CALL_RETURN",
      severity: "MEDIUM",
      message: "Low-level call return value not handled (missing success check).",
      location: `${file}:~${source.slice(0, m.index).split(/\r?\n/).length}`
    });
  }
  return findings;
}
