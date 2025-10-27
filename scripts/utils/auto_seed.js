import fs from "fs-extra";
import path from "path";

// A few public, verified-contract raw URLs (small, safe sample set).
// If network fails, we still seed offline examples.
const VERIFIED_URLS = [
  // OpenZeppelin ERC20 (short)
  "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/release-v4.9/contracts/token/ERC20/ERC20.sol",
  // Minimal Ownable
  "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/release-v4.9/contracts/access/Ownable.sol"
];

// Simple offline seeds
const OFFLINE_SAMPLES = {
  "SafeBank.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract SafeBank {
  mapping(address => uint256) private balances;
  function deposit() public payable { balances[msg.sender] += msg.value; }
  function withdraw(uint256 amount) public {
    require(balances[msg.sender] >= amount, "Insufficient");
    balances[msg.sender] -= amount;
    payable(msg.sender).transfer(amount);
  }
  function getBalance(address u) external view returns(uint256){ return balances[u]; }
}
`,
  "VulnerableBank.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract VulnerableBank {
  mapping(address => uint256) public balances;
  function deposit() public payable { balances[msg.sender] += msg.value; }
  function withdraw() public {
    uint256 amount = balances[msg.sender];
    require(amount > 0, "none");
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok, "send fail");
    balances[msg.sender] = 0;
  }
}
`,
  "GasDoS.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract GasDoS {
  uint[] public data;
  function add(uint n) public { for (uint i=0;i<n;i++) data.push(i); }
}
`
};

async function fetchText(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function autoSeedAndFetch({ OFFLINE_DIR, ONLINE_DIR, log }) {
  await fs.ensureDir(OFFLINE_DIR);
  await fs.ensureDir(ONLINE_DIR);

  // If completely empty, seed offline first.
  const countOffline = (await fs.readdir(OFFLINE_DIR)).filter(f => f.endsWith(".sol")).length;
  const countOnline = (await fs.readdir(ONLINE_DIR)).filter(f => f.endsWith(".sol")).length;

  if (countOffline + countOnline === 0) {
    // Write offline seeds
    for (const [name, code] of Object.entries(OFFLINE_SAMPLES)) {
      await fs.writeFile(path.join(OFFLINE_DIR, name), code, "utf8");
    }
    log?.(`Offline seeds written: ${Object.keys(OFFLINE_SAMPLES).length}`);
  }

  // Try to fetch verified contracts (best-effort)
  try {
    for (const url of VERIFIED_URLS) {
      const name = url.split("/").pop();
      const dst = path.join(ONLINE_DIR, name);
      if (await fs.pathExists(dst)) continue;
      const text = await fetchText(url, 9000);
      await fs.writeFile(dst, text, "utf8");
    }
    log?.(`Online verified contracts fetched (best-effort).`);
  } catch {
    log?.(`Online fetch skipped or failed; continuing with offline set.`);
  }
}
