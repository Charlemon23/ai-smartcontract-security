// SPDX-License-Identifier: MIT
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
}