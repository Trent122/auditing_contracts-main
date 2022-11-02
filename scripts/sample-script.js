async function main() {

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // deploy contracts here:
  const LenderPoolFactory = await ethers.getContractFactory("SecureLenderPool");
  lenderPool = await LenderPoolFactory.deploy();

  console.log("Smart contract address:", nftMarketplace.address)

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
