export default function txOriginRule({ file, source }) {
  const findings = [];
  const rx = /tx\.origin/g;
  let m;
  while ((m = rx.exec(source))) {
    findings.push({
      rule: "TX_ORIGIN_AUTH",
      severity: "HIGH",
      message: "Use of tx.origin for authorization is unsafe; use msg.sender.",
      location: `${file}:~${source.slice(0, m.index).split(/\r?\n/).length}`
    });
  }
  return findings;
}
