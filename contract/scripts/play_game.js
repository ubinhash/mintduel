const hre = require("hardhat");

async function main() {
  // Import configuration
  const { config } = require("./config");
  
  // Configuration - update these addresses
  const OTOM_DUEL_ADDRESS = config.OTOM_DUEL_ADDRESS; // TODO: Replace with deployed OtomDuel address
  const OTOM_TOKEN_ADDRESS = "0xc709F59f1356230025d4fdFDCeD92341A14FF2F8"; // TODO: Replace with OTOM token address
  const OTOM_DATABASE_ADDRESS = "0xC6E01938846D3d62EafD7FF485afeE416f6D8A40"; // TODO: Replace with OTOM database address
  
  // Game configuration
  const OTOM_IDS = ["109017886057251182666336718528581053198613765019388888759076809990227452125649","93652894349105158934513407931827023863396296658398851205876984838531481518931", "71625162033614001349820323117480365677712868814813255988761332079725894729185"]; // TODO: Replace with actual OTOM token IDs you want to use
  const MINT_PRICE = hre.ethers.parseEther("0.0001"); // 0.001 ETH

  console.log("=== OTOM Duel Game Setup ===");
  console.log("OTOM Duel Address:", OTOM_DUEL_ADDRESS);
  console.log("OTOM Token Address:", OTOM_TOKEN_ADDRESS);
  console.log("OTOM Database Address:", OTOM_DATABASE_ADDRESS);
  console.log("OTOM IDs to use:", OTOM_IDS);
  console.log("Mint Price:", hre.ethers.formatEther(MINT_PRICE), "ETH");

  // Get signers
  const [player] = await hre.ethers.getSigners();
  console.log("Player address:", player.address);

  // Get contract instances
  const otomDuel = await hre.ethers.getContractAt("OtomDuel", OTOM_DUEL_ADDRESS);
  const otomToken = await hre.ethers.getContractAt("IERC1155", OTOM_TOKEN_ADDRESS);

  console.log("\n=== Step 1: Check OTOM Token Balances ===");
  
  // Check balances for each OTOM
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

  console.log("\n=== Step 2: Check Current Approval ===");
  
  // Check current approval
  try {
    const isApproved = await otomToken.isApprovedForAll(player.address, OTOM_DUEL_ADDRESS);
    console.log("Current approval for all:", isApproved);
    
    if (isApproved) {
      console.log("✅ Already approved for all tokens");
    } else {
      console.log("❌ Not approved, setting approval...");
    }
  } catch (error) {
    console.log("❌ ERROR checking approval:", error.message);
    return;
  }

  console.log("\n=== Step 3: Set Approval For All ===");
  
  // Set approval for all tokens if not already approved
  try {
    const isApproved = await otomToken.isApprovedForAll(player.address, OTOM_DUEL_ADDRESS);
    
    if (!isApproved) {
      console.log("Setting approval for all OTOM tokens...");
      const approveTx = await otomToken.setApprovalForAll(OTOM_DUEL_ADDRESS, true);
      await approveTx.wait();
      console.log("✅ Approval set successfully");
      
      // Verify approval
      const newApproval = await otomToken.isApprovedForAll(player.address, OTOM_DUEL_ADDRESS);
      console.log("New approval status:", newApproval);
    }
  } catch (error) {
    console.log("❌ ERROR setting approval:", error.message);
    return;
  }

  console.log("\n=== Step 4: Validate OTOMs in Database ===");
  
  // Get OTOM database contract
  const otomDatabase = await hre.ethers.getContractAt("IOtomsDatabase", OTOM_DATABASE_ADDRESS);
  
  // Validate each OTOM
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
      
      // Get mass
      const mass = molecule.givingAtoms.length > 0 ? molecule.givingAtoms[0].mass : 0;
      console.log(`  Mass: ${mass}`);
      
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

  console.log("\n=== Step 5: Start Game ===");
  
  // Check if player already has an active game
  try {
    const activeGame = await otomDuel.getPlayerActiveGame(player.address);
    if (activeGame != 0) {
      console.log(`❌ ERROR: Player already has active game ID ${activeGame}`);
      return;
    }
  } catch (error) {
    console.log("❌ ERROR checking active game:", error.message);
    return;
  }

  // Start the game
  try {
    console.log("Starting game with OTOMs:", OTOM_IDS);
    console.log("Sending", hre.ethers.formatEther(MINT_PRICE), "ETH as stake...");
    
    const startGameTx = await otomDuel.startGame(OTOM_IDS, { value: MINT_PRICE });
    await startGameTx.wait();
    
    console.log("✅ Game started successfully!");
    
    // Get the new game ID
    const newGameId = await otomDuel.getPlayerActiveGame(player.address);
    console.log("New game ID:", newGameId.toString());
    
    // Get game details
    const gameDetails = await otomDuel.getGame(newGameId);
    console.log("\n=== Game Details ===");
    console.log("Player:", gameDetails.player);
    console.log("Staked OTOM IDs:", gameDetails.stakedOtomIds.map(id => id.toString()));
    console.log("OTOM Masses:", gameDetails.otomMasses.map(mass => mass.toString()));
    console.log("Agent Health:", gameDetails.agentHealth.toString());
    console.log("Current Round:", gameDetails.currentRound.toString());
    console.log("Game State:", gameDetails.state);
    console.log("Stake Amount:", hre.ethers.formatEther(gameDetails.stakeAmount), "ETH");
    
  } catch (error) {
    console.log("❌ ERROR starting game:", error.message);
    return;
  }

  console.log("\n=== Game Setup Complete ===");
  console.log("✅ OTOM tokens approved");
  console.log("✅ Game started successfully");
  console.log("✅ Ready for agent to make first move");
  console.log("\nNext steps:");
  console.log("1. Agent should call agentPlay() with commit hash");
  console.log("2. Player should call playerPlay() with action and OTOM index");
  console.log("3. Agent should call reveal() with action and secret");
  console.log("4. Repeat for rounds 2 and 3");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 