// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * DoS via unbounded loop over dynamic array.
 */
contract GasDoS {
    address[] public users;

    function add(address a) external { users.push(a); }

    function payout() external {
        // ❗ Unbounded iteration; can run out of gas as users grows
        for (uint256 i = 0; i < users.length; i++) {
            payable(users[i]).transfer(1 wei);
        }
    }

    receive() external payable {}
}
