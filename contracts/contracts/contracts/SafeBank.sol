// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Reentrancy-safe pattern using checks-effects-interactions.
 */
contract SafeBank {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "nothing to withdraw");
        balances[msg.sender] = 0; // effect first
        payable(msg.sender).transfer(amount); // interaction after
    }
}
