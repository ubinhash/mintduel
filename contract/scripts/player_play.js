const hre = require("hardhat");
const { config } = require("./config");

async function main() {
  // Import configuration
  const { config } = require("./config");
  
  // Configuration
  const OTOM_DUEL_ADDRESS = config.OTOM_DUEL_ADDRESS;
  const GAME_ID = 1; // TODO: Replace with actual game ID
  
  // Player action (1 = ATTACK, 2 = CHARGE)
  const PLAYER_ACTION = 2; // ATTACK for this example (enum value)
  const OTOM_INDEX = 2; // Index of OTOM to use (0, 1, or 2 for the 3 OTOMs staked)
  
  console.log("=== Player Play Script ===");
  console.log("OTOM Duel Address:", OTOM_DUEL_ADDRESS);
  console.log("Game ID:", GAME_ID);
  console.log("Player Action:", PLAYER_ACTION === 1 ? "ATTACK" : "CHARGE");
  console.log("OTOM Index:", OTOM_INDEX);

  // Get player signer
  const [player] = await hre.ethers.getSigners();
  console.log("Player address:", player.address);

  // Get contract instance
  const otomDuel = await hre.ethers.getContractAt("OtomDuel", OTOM_DUEL_ADDRESS, player);

  console.log("\n=== Step 1: Check Game Status ===");
  
  try {
    const gameDetails = await otomDuel.getGame(GAME_ID);
    console.log("Game State:", gameDetails.state);
    console.log("Current Round:", gameDetails.currentRound.toString());
    console.log("Player:", gameDetails.player);
    console.log("Agent Health:", gameDetails.agentHealth.toString());
    
    if (gameDetails.state != 1) { // 1 = ACTIVE
      console.log("❌ ERROR: Game is not active");
      return;
    }
    
    if (gameDetails.currentRound >= 3) {
      console.log("❌ ERROR: Game is already completed");
      return;
    }
    
    // Check if this is the correct player
    if (gameDetails.player.toLowerCase() !== player.address.toLowerCase()) {
      console.log("❌ ERROR: You are not the player of this game");
      console.log("Expected player:", gameDetails.player);
      console.log("Your address:", player.address);
      return;
    }
  } catch (error) {
    console.log("❌ ERROR checking game status:", error.message);
    return;
  }

  console.log("\n=== Step 2: Check if Agent Has Committed ===");
  
  try {
    // We can't directly check agent commits from outside, but we can try to play
    // and see if it fails due to agent not having committed
    console.log("Checking if agent has committed...");
  } catch (error) {
    console.log("❌ ERROR checking agent commit:", error.message);
    return;
  }

  console.log("\n=== Step 3: Validate OTOM Index ===");
  
  try {
    if (OTOM_INDEX < 0 || OTOM_INDEX > 2) {
      console.log("❌ ERROR: OTOM_INDEX must be 0, 1, or 2");
      return;
    }
    
    console.log("OTOM Index is valid:", OTOM_INDEX);
  } catch (error) {
    console.log("❌ ERROR validating OTOM index:", error.message);
    return;
  }

  console.log("\n=== Step 4: Call playerPlay ===");
  
  try {
    console.log("Calling playerPlay with action:", PLAYER_ACTION, "and OTOM index:", OTOM_INDEX);
    
    const playerPlayTx = await otomDuel.playerPlay(GAME_ID, PLAYER_ACTION, OTOM_INDEX);
    await playerPlayTx.wait();
    
    console.log("✅ Player move submitted successfully!");
    console.log("Transaction hash:", playerPlayTx.hash);
    
  } catch (error) {
    console.log("❌ ERROR calling playerPlay:", error.message);
    
    // Common error messages and their meanings
    if (error.message.includes("Agent must commit first")) {
      console.log("💡 HINT: Agent needs to call agentPlay() first");
    } else if (error.message.includes("Player already played")) {
      console.log("💡 HINT: Player already played for this round");
    } else if (error.message.includes("Invalid OTOM index")) {
      console.log("💡 HINT: OTOM index must be 0, 1, or 2");
    } else if (error.message.includes("OTOM already used")) {
      console.log("💡 HINT: This OTOM has already been used in a previous round");
    } else if (error.message.includes("Not the player")) {
      console.log("💡 HINT: Only the game player can call this function");
    }
    
    return;
  }

  console.log("\n=== Player Move Complete ===");
  console.log("✅ Player has made their move");
  console.log("✅ Agent can now call reveal() to complete the round");
  console.log("\nNext steps:");
  console.log("1. Agent calls reveal() with their action and secret");
  console.log("2. Round outcome is calculated and health is updated");
  console.log("3. If game continues, agent calls agentPlay() for next round");
}

// Helper function to get action name
function getActionName(action) {
  switch (action) {
    case 0: return "ATTACK";
    case 1: return "CHARGE";
    default: return "UNKNOWN";
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 