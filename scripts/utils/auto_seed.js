import fs from "fs-extra";
import path from "path";

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

export async function autoSeedAndFetch({ OFFLINE_DIR, ONLINE_DIR, log }) {
  await fs.ensureDir(OFFLINE_DIR);
  await fs.ensureDir(ONLINE_DIR);

  const countOffline = (await fs.readdir(OFFLINE_DIR)).filter(f => f.endsWith(".sol")).length;
  const countOnline = (await fs.readdir(ONLINE_DIR)).filter(f => f.endsWith(".sol")).length;

  if (countOffline + countOnline === 0) {
    for (const [name, code] of Object.entries(OFFLINE_SAMPLES)) {
      const dst = path.join(OFFLINE_DIR, name);
      await fs.writeFile(dst, code, "utf8");
    }
    log?.(`Offline contracts seeded manually.`);
  }
}
