// scripts/import_dataset.js
import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../data/contracts/offline_seed");

async function importDataset() {
  console.log(chalk.cyanBright("\n=== Initializing Local Verified Contracts Dataset ===\n"));
  fs.ensureDirSync(DATA_DIR);

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

    "GasDoS.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract GasDoS {
    uint[] public data;
    function add(uint n) public {
        for (uint i = 0; i < n; i++) data.push(i);
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
        (bool success,) = msg.sender.call{value: amount}("");
        require(success);
        balances[msg.sender] = 0;
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

  for (const [file, code] of Object.entries(samples)) {
    const filePath = path.join(DATA_DIR, file);
    fs.writeFileSync(filePath, code, "utf8");
  }

  console.log(chalk.greenBright(`✅ Local dataset initialized in ${DATA_DIR}`));
  console.log(chalk.gray("Contains 4 verified Solidity contracts.\n"));
}

importDataset();
