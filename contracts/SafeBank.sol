// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SafeBank
 * @dev A secure example of a simple bank contract that demonstrates the
 *      checks-effects-interactions pattern to prevent reentrancy attacks.
 */
contract SafeBank {
    // Track user balances
    mapping(address => uint256) public balances;

    /**
     * @notice Deposit ether into the bank
     */
    function deposit() external payable {
        require(msg.value > 0, "Deposit must be greater than zero");
        balances[msg.sender] += msg.value;
    }

    /**
     * @notice Withdraw the caller's entire balance safely
     */
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        // ✅ Effects: set balance to 0 *before* the external call
        balances[msg.sender] = 0;

        // ✅ Interaction: transfer funds after state update
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Check the balance of any account
     * @param account Address to query
     * @return balance The balance of the account in wei
     */
    function getBalance(address account) external view returns (uint256 balance) {
        return balances[account];
    }

    /**
     * @notice Allow the contract to receive Ether directly
     */
    receive() external payable {
        balances[msg.sender] += msg.value;
    }
}
