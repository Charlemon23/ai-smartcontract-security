export default function unboundedLoopRule({ file, source }) {
  const findings = [];
  const forRx = /for\s*\(\s*uint\d*\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*\w+\.length\s*;/g;
  let m;
  while ((m = forRx.exec(source))) {
    findings.push({
      rule: "UNBOUNDED_LOOP",
      severity: "MEDIUM",
      message: "Loop iterates over dynamic array length; potential gas DoS.",
      location: `${file}:~${source.slice(0, m.index).split(/\r?\n/).length}`
    });
  }
  return findings;
}
