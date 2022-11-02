const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Common solidity pitfalls", function () {
  let vulnerablePool, securePool, receiver, attack
  let deployer, miner, user1, user2, attacker, users
  beforeEach(async function () {
    // Get the ContractFactory 
    const VulnerablePoolFactory = await ethers.getContractFactory("VulnerableLenderPool")
    const SecurePoolFactory = await ethers.getContractFactory("SecureLenderPool")
    const FlashLoanReceiverFactory = await ethers.getContractFactory('FlashLoanReceiver')
    const AttackFactory = await ethers.getContractFactory("Attack");
    // And get signers here
    [deployer, attacker, miner, user1, user2, ...users] = await ethers.getSigners()

    // Deploy contracts 
    vulnerablePool = await VulnerablePoolFactory.deploy()
    securePool = await SecurePoolFactory.deploy()
    receiver = await FlashLoanReceiverFactory.deploy([vulnerablePool.address, securePool.address])
    attack = await AttackFactory.deploy([vulnerablePool.address, securePool.address])
  });
  it("Missing input or precondition check", async function () {
    const depositAmount = ethers.utils.parseEther("4.2")
    // Vulnerable pool will not precisely track the balance of 
    // users who deposit amounts that aren't divisible by position amount.
    await vulnerablePool.deposit({ value: depositAmount });
    let result = await vulnerablePool.getBalance(deployer.address)
    expect(result).to.not.equal(depositAmount)
    expect(result).to.equal(ethers.utils.parseEther("4"))
    // Secure pool checks that deposit amounts are divisible by position amount.
    // So pool will always track balances precisely.
    await expect(securePool.deposit({ value: depositAmount })).to.be.revertedWith("Error, deposit value must be an interval of the position amount");
    let newDepositAmount = ethers.utils.parseEther("4")
    await securePool.deposit({ value: newDepositAmount });
    expect(await securePool.getBalance(deployer.address)).to.equal(newDepositAmount)
  });
  it("Phishing vulnerability with tx.origin", async function () {
    // Attacker tricks owner of vulnerable pool into calling phishing malicous contract.
    // This makes it such that malicous contract is able to act on the deployers behalf
    // and set the fee percent on their lender pool
    await attack.phishing(0);
    expect(await vulnerablePool.feePercent()).to.equal(100);
    // Attacker tries the same phisihing attack on secure pool
    // but it should fail because it the set fee function uses
    // msg.sender to authenticate instead of tx.origin
    await expect(attack.phishing(1)).to.be.revertedWith("Only owner");
  });
  it("Incorrect calculation of output token amount", async function () {
    const tokenAmount = ethers.utils.parseEther("100")
    // The get fee function on the vulnerable pool will return 0 for any amount
    // due to incorrect order of operations in the calculation (dividing then multiplying)
    expect(await vulnerablePool.getFee(tokenAmount)).to.equal(0);
    // The get fee function on the vulnerable pool will return the correct fee amount of 1 ether
    // b/c it calculates it with correct order of operations (multiplying then dividing)
    expect(await securePool.getFee(tokenAmount)).to.equal(ethers.utils.parseEther("1"));
  });
  it("Timestamp manipulation", async function () {
    // user 1 deposits 1 ether into their receiver contract
    await user1.sendTransaction({ to: receiver.address, value: ethers.utils.parseEther("1") });
    // Deployer deposits 1.5 ether
    await vulnerablePool.deposit({ value: ethers.utils.parseEther("1.5") })
    // Miner deposits minimum amount of 0.25 ether
    await (await vulnerablePool.connect(miner).deposit({ value: ethers.utils.parseEther(".25") })).wait()
    const poolBalance = await ethers.provider.getBalance(vulnerablePool.address)
    const positionCount = await vulnerablePool.positionCount()
    // Get block difficulty for the block that will include the flashloan transaction
    let difficulty = 132608
    let block = await ethers.provider.getBlock("latest")
    // B/c new blocks are added once every 15 seconds on average, 
    // the miner who solves the cryptographic puzzle for the block
    // is able to select from 15 different timestamp values.
    // Allowing him to generate 15 different random numbers. 
    // If one of these numbers generates a random number that selects his 7th position 
    // to recieve the fee, he will publish the block with the timestamp that genrated that number.
    // So this increase the likelyhood that the miner will recieve the fee by 15x.
    // This is not a fair way to distribute fees to depositors.
    // The secure pool distrubtes fees fairly b/c it uses chainlinks verified 
    // randomness to feed the contract with a random number that doesn't depend on
    // block.timestamp.
    for (let i = 1; i <= 15; i++) {
      const hash = ethers.utils.solidityKeccak256(["uint256", "uint256"], [difficulty, block.timestamp + i])
      const number = ethers.BigNumber.from(hash).mod(positionCount)
      if (number.toNumber() + 1 == positionCount.toNumber()) {
        // Increase it by the amount needed to generate a random number that picks the miners positions to receive the fees
        await ethers.provider.send("evm_increaseTime", [i]);
        const initEthBalance = await miner.getBalance()
        await (await vulnerablePool.connect(deployer).flashLoan(receiver.address, poolBalance)).wait()
        expect(await miner.getBalance()).to.equal(initEthBalance.add(poolBalance.div(100)))
        break;
      }
    }
  });
  it("Block gas limit vulnerabilities", async function () {
    // B/c the deposit function contains an unbounded for loop, 
    // (length of loop depends on the deposit amount)
    // the amount of gas that could be consumed by the function has no limit.
    // So in order to prevent out of gas errors, we need to place limits 
    // on the amount that an account can deposit per transaction.
    let estimate = await ethers.provider.estimateGas({
      // Wrapped ETH address
      to: vulnerablePool.address,

      // `function deposit() payable`
      data: "0xd0e30db0",

      // 1 ether
      value: ethers.utils.parseEther("50")
    });
    console.log("Gas price for 50 eth deposit", estimate.toNumber())
    estimate = await ethers.provider.estimateGas({
      // Wrapped ETH address
      to: vulnerablePool.address,

      // `function deposit() payable`
      data: "0xd0e30db0",

      // 1 ether
      value: ethers.utils.parseEther("100")
    })
    console.log("Gas price for 100 eth deposit", estimate.toNumber())
    estimate = await ethers.provider.estimateGas({
      // Wrapped ETH address
      to: vulnerablePool.address,

      // `function deposit() payable`
      data: "0xd0e30db0",

      // 1 ether
      value: ethers.utils.parseEther("150")
    })
    console.log("Gas price for 150 eth deposit", estimate.toNumber())

    // In order to prevent out of gas errors, for the secure pool we 
    // set a limit of 100 ether per deposit,
    // so depositing 101 ether will trigger a revert.
    await expect(securePool.deposit({ value: ethers.utils.parseEther("101") })).to.be.revertedWith("Can't deposit more than 100 ether at a time")
  });
});
