const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SafeBank", () => {
  it("deposits and withdraws safely", async () => {
    const [u] = await ethers.getSigners();
    const Bank = await ethers.getContractFactory("SafeBank");
    const bank = await Bank.deploy();
    await bank.waitForDeployment();

    await bank.connect(u).deposit({ value: ethers.parseEther("1") });
    expect(await bank.balances(u.address)).to.equal(ethers.parseEther("1"));

    await bank.connect(u).withdraw();
    expect(await bank.balances(u.address)).to.equal(0n);
  });
});
