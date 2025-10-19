const { expect } = require("chai");
const { ethers, artifacts } = require("hardhat");

describe("SafeBank", function () {
  it("deposits and withdraws safely", async function () {
    // Get signer (test account)
    const [user] = await ethers.getSigners();

    // Load artifact explicitly from correct path
    const SafeBankArtifact = await artifacts.readArtifact("contracts/SafeBank.sol:SafeBank");

    // Create a factory and deploy the contract
    const SafeBankFactory = new ethers.ContractFactory(
      SafeBankArtifact.abi,
      SafeBankArtifact.bytecode,
      user
    );

    const bank = await SafeBankFactory.deploy();
    await bank.waitForDeployment();

    // Deposit 1 ETH
    await bank.connect(user).deposit({ value: ethers.parseEther("1") });
    expect(await bank.balances(user.address)).to.equal(ethers.parseEther("1"));

    // Withdraw funds
    await bank.connect(user).withdraw();
    expect(await bank.balances(user.address)).to.equal(0n);
  });
});
