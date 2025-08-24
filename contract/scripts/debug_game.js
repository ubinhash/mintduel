const hre = require("hardhat");

async function main() {
  // Import configuration
  const { config } = require("./config");
  
  // Configuration - same as your play_game.js
  const OTOM_DUEL_ADDRESS = config.OTOM_DUEL_ADDRESS;
  const OTOM_TOKEN_ADDRESS = "0xc709F59f1356230025d4fdFDCeD92341A14FF2F8";
  const OTOM_DATABASE_ADDRESS = "0xC6E01938846D3d62EafD7FF485afeE416f6D8A40";
  const OTOM_IDS = ["109411192323005013320236074910166367482792971750025377481544980126703983546020","82314540186597377019741273775235000929070457658490928548440454198341617233474", "76612613030139906190416043413639270804084087784678403991241784143365240601690"];
  const MINT_PRICE = hre.ethers.parseEther("0.0001");

  console.log("=== DEBUG: OTOM Duel Game Start ===");

  // Get signers
  const [player] = await hre.ethers.getSigners();
  console.log("Player address:", player.address);

  // Get contract instances
  const otomDuel = await hre.ethers.getContractAt("OtomDuel", OTOM_DUEL_ADDRESS);
  const otomToken = await hre.ethers.getContractAt("IERC1155", OTOM_TOKEN_ADDRESS);
  const otomDatabase = await hre.ethers.getContractAt("IOtomsDatabase", OTOM_DATABASE_ADDRESS);

  console.log("\n=== Step 1: Check Contract Configuration ===");
  
  try {
    // Check if database and token addresses are set
    const databaseAddress = await otomDuel.otomDatabase();
    const tokenAddress = await otomDuel.otomToken();
    console.log("Database address in contract:", databaseAddress);
    console.log("Token address in contract:", tokenAddress);
    
    if (databaseAddress === "0x0000000000000000000000000000000000000000") {
      console.log("❌ ERROR: Database address not set in contract");
      return;
    }
    
    if (tokenAddress === "0x0000000000000000000000000000000000000000") {
      console.log("❌ ERROR: Token address not set in contract");
      return;
    }
  } catch (error) {
    console.log("❌ ERROR checking contract configuration:", error.message);
    return;
  }

  console.log("\n=== Step 2: Check MINT_PRICE ===");
  
  try {
    const contractMintPrice = await otomDuel.MINT_PRICE();
    console.log("Contract MINT_PRICE:", hre.ethers.formatEther(contractMintPrice), "ETH");
    console.log("Your MINT_PRICE:", hre.ethers.formatEther(MINT_PRICE), "ETH");
    
    if (contractMintPrice !== MINT_PRICE) {
      console.log("❌ ERROR: MINT_PRICE mismatch!");
      console.log("Use this value instead:", hre.ethers.formatEther(contractMintPrice), "ETH");
      return;
    }
  } catch (error) {
    console.log("❌ ERROR checking MINT_PRICE:", error.message);
    return;
  }

  console.log("\n=== Step 3: Check Active Game ===");
  
  try {
    const activeGame = await otomDuel.getPlayerActiveGame(player.address);
    console.log("Active game ID:", activeGame.toString());
    
    if (activeGame != 0) {
      console.log("❌ ERROR: Player already has active game");
      return;
    }
  } catch (error) {
    console.log("❌ ERROR checking active game:", error.message);
    return;
  }

  console.log("\n=== Step 4: Check Token Balances ===");
  
  for (let i = 0; i < OTOM_IDS.length; i++) {
    try {
      const balance = await otomToken.balanceOf(player.address, OTOM_IDS[i]);
      console.log(`OTOM ID ${OTOM_IDS[i]}: Balance = ${balance.toString()}`);
      
      if (balance < 1) {
        console.log(`❌ ERROR: Insufficient balance for OTOM ID ${OTOM_IDS[i]}`);
        return;
      }
    } catch (error) {
      console.log(`❌ ERROR checking balance for OTOM ID ${OTOM_IDS[i]}:`, error.message);
      return;
    }
  }

  console.log("\n=== Step 5: Check Approval ===");
  
  try {
    const isApproved = await otomToken.isApprovedForAll(player.address, OTOM_DUEL_ADDRESS);
    console.log("Approval status:", isApproved);
    
    if (!isApproved) {
      console.log("❌ ERROR: Not approved for all tokens");
      return;
    }
  } catch (error) {
    console.log("❌ ERROR checking approval:", error.message);
    return;
  }

  console.log("\n=== Step 6: Validate OTOMs in Database ===");
  
  let totalMass = 0;
  
  for (let i = 0; i < OTOM_IDS.length; i++) {
    try {
      console.log(`\nValidating OTOM ID ${OTOM_IDS[i]}...`);
      
      // Get molecule data
      const molecule = await otomDatabase.getMoleculeByTokenId(OTOM_IDS[i]);
      
      // Check if it's in Alpha Universe
      const alphaUniverseHash = "0xfda008503288e5abc370328150d20993fec26efe5707f2d12ab552ebb0da5e26";
      const isInAlphaUniverse = molecule.universeHash === alphaUniverseHash;
      console.log(`  Universe Hash: ${molecule.universeHash}`);
      console.log(`  In Alpha Universe: ${isInAlphaUniverse}`);
      
      // Check if it's a singleton
      const isSingleton = molecule.bond.bondType === "singleton";
      console.log(`  Bond Type: ${molecule.bond.bondType}`);
      console.log(`  Is Singleton: ${isSingleton}`);
      
      // Get mass (RAW VALUE - no division)
      const rawMass = molecule.givingAtoms.length > 0 ? molecule.givingAtoms[0].mass : 0;
      console.log(`  Raw Mass: ${rawMass.toString()}`);
      
      // Calculate mass as contract would (with division by 1e18)
      const calculatedMass = rawMass / BigInt(1e18);
      console.log(`  Calculated Mass (after /1e18): ${calculatedMass.toString()}`);
      
      totalMass += Number(calculatedMass);
      console.log(`  Running Total Mass: ${totalMass}`);
      
      if (!isInAlphaUniverse) {
        console.log(`❌ ERROR: OTOM ID ${OTOM_IDS[i]} is not in Alpha Universe`);
        return;
      }
      
      if (!isSingleton) {
        console.log(`❌ ERROR: OTOM ID ${OTOM_IDS[i]} is not a singleton`);
        return;
      }
      
      console.log(`✅ OTOM ID ${OTOM_IDS[i]} is valid`);
      
    } catch (error) {
      console.log(`❌ ERROR validating OTOM ID ${OTOM_IDS[i]}:`, error.message);
      return;
    }
  }

  console.log(`\n=== Final Mass Check ===`);
  console.log(`Total Mass: ${totalMass}`);
  console.log(`Mass <= 100: ${totalMass <= 100}`);
  
  if (totalMass > 100) {
    console.log("❌ ERROR: Total mass exceeds 100");
    return;
  }

  console.log("\n=== All Checks Passed ===");
  console.log("✅ Contract configuration is correct");
  console.log("✅ MINT_PRICE is correct");
  console.log("✅ No active game");
  console.log("✅ Token balances are sufficient");
  console.log("✅ Approval is set");
  console.log("✅ OTOMs are valid (Alpha Universe, singletons)");
  console.log("✅ Total mass is within limits");
  console.log("\nThe issue might be in the contract logic. Check the contract's startGame function.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 