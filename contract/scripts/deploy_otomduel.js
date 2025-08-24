const hre = require("hardhat");
const { config } = require("./config");

async function main() {
  // Configuration - you should provide these addresses

//   otomToken =IERC1155(0x2f9810789aebBB6cdC6c0332948fF3B6D11121E3);
//   otomDatabase =IOtomsDatabase(0x953761a771d6Ad9F888e41b3E7c9338a32b1A346);


  //Testnet
  // otomToken = IERC1155(0xc709F59f1356230025d4fdFDCeD92341A14FF2F8);
  // otomDatabase =IOtomsDatabase(0xC6E01938846D3d62EafD7FF485afeE416f6D8A40);

  const AGENT_ADDRESS = "0x48Dc4876472CbA3d91da6100a5B7fDeAAc062353"; // TODO: Replace with actual agent address
  const OTOM_DATABASE_ADDRESS = "0xC6E01938846D3d62EafD7FF485afeE416f6D8A40"; // TODO: Replace with actual database address
  const OTOM_TOKEN_ADDRESS = "0xc709F59f1356230025d4fdFDCeD92341A14FF2F8"; // TODO: Replace with actual token address
  const SAMPLE_NFT_ADDRESS = config.SAMPLE_NFT_ADDRESS; // Get from config file

  console.log("Deploying OtomDuel contract...");
  console.log("Agent address:", AGENT_ADDRESS);
  console.log("OTOM Database address:", OTOM_DATABASE_ADDRESS);
  console.log("OTOM Token address:", OTOM_TOKEN_ADDRESS);
  console.log("Sample NFT address:", SAMPLE_NFT_ADDRESS);

  // Deploy the OtomDuel contract
  const OtomDuel = await hre.ethers.getContractFactory("OtomDuel");
  const otomDuel = await OtomDuel.deploy();
  await otomDuel.waitForDeployment();
  const otomDuelAddress = await otomDuel.getAddress();
  console.log("OtomDuel deployed to:", otomDuelAddress);

  // Verify OtomDuel
  console.log("Verifying OtomDuel...");
  try {
    await hre.run("verify:verify", {
      address: otomDuelAddress,
      constructorArguments: [],
    });
    console.log("OtomDuel verified successfully");
  } catch (error) {
    console.log("Error verifying OtomDuel:", error.message);
  }

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Set up agent whitelist
  console.log("Setting up agent whitelist...");
  try {
    const whitelistTx = await otomDuel.setAgentWhitelist(AGENT_ADDRESS, true);
    await whitelistTx.wait();
    console.log("Agent whitelisted successfully:", AGENT_ADDRESS);

    // Verify agent is whitelisted
    const isWhitelisted = await otomDuel.whitelistedAgents(AGENT_ADDRESS);
    console.log("Agent whitelist status:", isWhitelisted);
  } catch (error) {
    console.log("Error setting agent whitelist:", error.message);
  }

  // Set OTOM database and token addresses (if provided)
  if (OTOM_DATABASE_ADDRESS !== "0x...") {
    console.log("Setting OTOM database address...");
    try {
      const setDbTx = await otomDuel.setOtomDatabase(OTOM_DATABASE_ADDRESS);
      await setDbTx.wait();
      console.log("OTOM database address set successfully");
    } catch (error) {
      console.log("Error setting OTOM database:", error.message);
    }
  }

  if (OTOM_TOKEN_ADDRESS !== "0x...") {
    console.log("Setting OTOM token address...");
    try {
      const setTokenTx = await otomDuel.setOtomToken(OTOM_TOKEN_ADDRESS);
      await setTokenTx.wait();
      console.log("OTOM token address set successfully");
    } catch (error) {
      console.log("Error setting OTOM token:", error.message);
    }
  }

  // Set Sample NFT address (if provided)
  if (SAMPLE_NFT_ADDRESS !== "0x...") {
    console.log("Setting Sample NFT address...");
    try {
      const setNFTTx = await otomDuel.setSampleNFT(SAMPLE_NFT_ADDRESS);
      await setNFTTx.wait();
      console.log("Sample NFT address set successfully");
    } catch (error) {
      console.log("Error setting Sample NFT:", error.message);
    }
  }

  // Test contract constants
  console.log("Testing contract constants...");
  try {
    const startingHealth = await otomDuel.STARTING_HEALTH();
    const maxHealth = await otomDuel.MAX_HEALTH();
    const roundsPerGame = await otomDuel.ROUNDS_PER_GAME();
    const mintPrice = await otomDuel.MINT_PRICE();
    const alphaUniverseHash = await otomDuel.ALPHA_UNIVERSE_HASH();

    console.log("Starting Health:", startingHealth.toString());
    console.log("Max Health:", maxHealth.toString());
    console.log("Rounds Per Game:", roundsPerGame.toString());
    console.log("Mint Price:", hre.ethers.formatEther(mintPrice), "ETH");
    console.log("Alpha Universe Hash:", alphaUniverseHash);
  } catch (error) {
    console.log("Error reading constants:", error.message);
  }

  // Test basic contract functions
  console.log("Testing basic contract functions...");
  try {
    const owner = await otomDuel.owner();
    console.log("Contract owner:", owner);
    
    // Test emergency withdraw (should fail if no balance)
    try {
      const withdrawTx = await otomDuel.emergencyWithdraw();
      await withdrawTx.wait();
      console.log("Emergency withdraw successful");
    } catch (error) {
      console.log("Emergency withdraw failed (expected if no balance):", error.message);
    }

  } catch (error) {
    console.log("Error testing contract functions:", error.message);
  }

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("OtomDuel deployed to:", otomDuelAddress);
  console.log("Contract owner:", deployer.address);
  console.log("Whitelisted agent:", AGENT_ADDRESS);
  console.log("OTOM Database:", OTOM_DATABASE_ADDRESS);
  console.log("OTOM Token:", OTOM_TOKEN_ADDRESS);
  console.log("Sample NFT:", SAMPLE_NFT_ADDRESS);
  console.log("\nNext steps:");
  console.log("1. Update the addresses in this script if not already set");
  console.log("2. Deploy SampleNFT contract and add OtomDuel as operator");
  console.log("3. Update SAMPLE_NFT_ADDRESS in this script");
  console.log("4. Ensure OTOMs are in Alpha Universe and are singletons");
  console.log("5. Test full game flow with actual OTOM transfers");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
