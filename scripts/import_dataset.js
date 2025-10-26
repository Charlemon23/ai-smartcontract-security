// scripts/import_dataset.js
import fs from "fs-extra";
import path from "path";

const DATA_DIR = "data/contracts/offline_seed";

const samples = {
  "SafeBank.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract SafeBank {
    mapping(address => uint) public balances;
    function deposit() public payable { balances[msg.sender] += msg.value; }
    function withdraw(uint amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
}`,

  "VulnerableBank.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract VulnerableBank {
    mapping(address => uint) public balances;
    function deposit() public payable { balances[msg.sender] += msg.value; }
    function withdraw() public {
        uint amount = balances[msg.sender];
        require(amount > 0);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);
        balances[msg.sender] = 0;
    }
}`,

  "GasDoS.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract GasDoS {
    uint[] public data;
    function add(uint n) public {
        for (uint i = 0; i < n; i++) {
            data.push(i);
        }
    }
}`,

  "ERC20Token.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract ERC20Token {
    string public name = "DemoToken";
    string public symbol = "DMT";
    uint8 public decimals = 18;
    uint public totalSupply = 1000000 * 10 ** uint(decimals);
    mapping(address => uint) public balanceOf;
    event Transfer(address indexed from, address indexed to, uint value);
    constructor() { balanceOf[msg.sender] = totalSupply; }
    function transfer(address to, uint value) public returns (bool) {
        require(balanceOf[msg.sender] >= value);
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }
}`
};

function seed() {
  fs.ensureDirSync(DATA_DIR);
  let created = 0;
  for (const [name, code] of Object.entries(samples)) {
    const p = path.join(DATA_DIR, name);
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, code, "utf8");
      created++;
    }
  }
  console.log(`✅ Local dataset ready at ${DATA_DIR} (${created} file(s) created or already present).`);
}

seed();