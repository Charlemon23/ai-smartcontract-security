// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract GasDoS {
    uint[] public data;
    function add(uint n) public {
        for (uint i = 0; i < n; i++) data.push(i);
    }
}