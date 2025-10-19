/**
 * Heuristic: flag patterns where an external call happens
 * before a state write to a mapping/variable previously read.
 * We approximate by searching for .call/.delegatecall/.send/.transfer
 * in a function that also writes to state vars *after* the call in source order.
 */
export default function reentrancyRule({ file, source }) {
  const findings = [];
  const lines = source.split(/\r?\n/);

  let func = null;
  lines.forEach((ln, idx) => {
    if (/function\s+\w+\s*\(/.test(ln)) func = { start: idx + 1, sawExternalCall: false, sawStateWritePostCall: false };
    if (func) {
      if (/\.(call|delegatecall|send|transfer)\s*\{?value?/.test(ln)) func.sawExternalCall = true;
      if (func.sawExternalCall && /=\s*(?:0|.+balances|\w+\[.*\])/.test(ln)) func.sawStateWritePostCall = true;
      if (/\}/.test(ln)) {
        if (func.sawExternalCall && func.sawStateWritePostCall) {
          findings.push({
            rule: "REENTRANCY_CEI",
            severity: "HIGH",
            message: "External call before state update (violates checks-effects-interactions).",
            location: `${file}:${func.start}-${idx + 1}`
          });
        }
        func = null;
      }
    }
  });
  return findings;
}
