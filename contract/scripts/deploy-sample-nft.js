const { ethers, run } = require("hardhat");
const { config } = require("./config");
async function main() {
  console.log("🚀 Deploying SampleNFT to Shape Sepolia...");

  const [deployer] = await ethers.getSigners();
  console.log("📋 Deploying from account:", deployer.address);


  // OTOM_DUEL_ADDRESS from the addresses.ts file
  const OTOM_DUEL_ADDRESS = config.OTOM_DUEL_ADDRESS;

  // Deploy SampleNFT contract
  const SampleNFT = await ethers.getContractFactory("SampleNFT");
  const sampleNFT = await SampleNFT.deploy();
  await sampleNFT.waitForDeployment();

  const contractAddress = await sampleNFT.getAddress();
  console.log("✅ SampleNFT deployed to:", contractAddress);

  // Get contract instance for verification
  const sampleNFTContract = await ethers.getContractAt("SampleNFT", contractAddress);

  // Verify contract info
  console.log("\n📋 Contract Details:");
  console.log("- Name:", await sampleNFTContract.name());
  console.log("- Symbol:", await sampleNFTContract.symbol());
  console.log("- Owner:", await sampleNFTContract.owner());
  console.log("- Current Token ID:", await sampleNFTContract.getCurrentTokenId());
  console.log("- Total Supply:", await sampleNFTContract.totalSupply());
  console.log("- Base URI:", await sampleNFTContract.getBaseURI());

  // Add OTOM_DUEL_ADDRESS as operator
  console.log("\n🔧 Adding OTOM_DUEL_ADDRESS as operator...");
  const addOperatorTx = await sampleNFTContract.addOperator(OTOM_DUEL_ADDRESS);
  await addOperatorTx.wait();
  console.log("✅ OTOM_DUEL_ADDRESS added as operator");

  // Verify operator was added
  const isOperator = await sampleNFTContract.isOperator(OTOM_DUEL_ADDRESS);
  console.log("- Is OTOM_DUEL_ADDRESS operator?", isOperator);

  // Verify on Shapescan
  console.log("\n🔍 Verifying the contract on Shapescan...");
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });
    console.log("✅ Contract verified on Shapescan");
  } catch (error) {
    console.log("⚠️ Verification failed:", error.message);
  }

  console.log("\n🌐 Explorer Links:");
  console.log("- Contract:", `https://sepolia.shapescan.xyz/address/${contractAddress}`);
  console.log("- OTOM Duel Contract:", `https://sepolia.shapescan.xyz/address/${OTOM_DUEL_ADDRESS}`);

  console.log("\n🔧 Add this to your MCP server addresses.ts:");
  console.log(`sampleNFT: {`);
  console.log(`  [shapeSepolia.id]: '${contractAddress}',`);
  console.log(`  [shape.id]: zeroAddress, // Replace with actual address when deployed to mainnet`);
  console.log(`},`);

  console.log("\n📝 Summary:");
  console.log(`- SampleNFT deployed to: ${contractAddress}`);
  console.log(`- OTOM_DUEL_ADDRESS (${OTOM_DUEL_ADDRESS}) added as operator`);
  console.log(`- Contract verified on Shapescan`);
  console.log(`- Ready for OTOM Duel integration!`);

  return {
    contractAddress,
    otomDuelAddress: OTOM_DUEL_ADDRESS,
    deployer: deployer.address,
  };
}

main()
  .then((result) => {
    console.log("\n🎉 Deployment completed successfully!");
    console.log("Contract Address:", result.contractAddress);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }); 