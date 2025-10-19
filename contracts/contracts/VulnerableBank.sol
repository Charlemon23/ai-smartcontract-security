// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Deliberately vulnerable to reentrancy via withdraw().
 * For scanner regression tests.
 */
contract VulnerableBank {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "nothing to withdraw");

        // ❌ Vulnerable: external call before state update
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");

        // state change happens after call
        balances[msg.sender] = 0;
    }
}
