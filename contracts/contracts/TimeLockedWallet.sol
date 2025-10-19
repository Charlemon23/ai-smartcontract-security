// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Timestamp dependency example.
 */
contract TimeLockedWallet {
    uint256 public unlockTime;

    constructor(uint256 _unlockTime) payable {
        unlockTime = _unlockTime; // could be manipulated in tests
    }

    function withdraw() external {
        // ❗ timestamp dependence (heuristic flag)
        require(block.timestamp >= unlockTime, "locked");
        payable(msg.sender).transfer(address(this).balance);
    }
}
