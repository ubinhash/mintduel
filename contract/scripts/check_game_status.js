const hre = require("hardhat");
const { config } = require("./config");

async function main() {
  // Import configuration
  const { config } = require("./config");
  
  // Configuration
  const OTOM_DUEL_ADDRESS = config.OTOM_DUEL_ADDRESS;
  const GAME_ID = 1; // TODO: Replace with actual game ID

  console.log("=== Game Turn Status Check ===");
  console.log("OTOM Duel Address:", OTOM_DUEL_ADDRESS);
  console.log("Game ID:", GAME_ID);

  // Get signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer address:", signer.address);

  // Get contract instance
  const otomDuel = await hre.ethers.getContractAt("OtomDuel", OTOM_DUEL_ADDRESS);

  console.log("\n=== Step 1: Check Game Turn Status ===");
  
  try {
    const turnStatus = await otomDuel.getGameTurnStatus(GAME_ID);
    
    console.log("Current Round:", turnStatus.currentRound.toString());
    console.log("Is Agent Turn:", turnStatus.isAgentTurn);
    console.log("Agent Committed:", turnStatus.agentCommitted);
    console.log("Player Played:", turnStatus.playerPlayed);
    console.log("Round Completed:", turnStatus.roundCompleted);
    console.log("Game State:", turnStatus.gameState.toString());
    
    // Interpret game state
    let gameStateName;
    switch (turnStatus.gameState) {
      case 0: gameStateName = "WAITING"; break;
      case 1: gameStateName = "ACTIVE"; break;
      case 2: gameStateName = "COMPLETED"; break;
      case 3: gameStateName = "CANCELLED"; break;
      default: gameStateName = "UNKNOWN"; break;
    }
    console.log("Game State Name:", gameStateName);
    
  } catch (error) {
    console.log("❌ ERROR checking game turn status:", error.message);
    return;
  }

  console.log("\n=== Step 2: Get Full Game Details ===");
  
  try {
    const gameDetails = await otomDuel.getGame(GAME_ID);
    
    console.log("Player:", gameDetails.player);
    console.log("Agent Health:", gameDetails.agentHealth.toString());
    console.log("Current Round:", gameDetails.currentRound.toString());
    console.log("Accumulated Charge:", gameDetails.accumulatedCharge.toString());
    console.log("Stake Amount:", hre.ethers.formatEther(gameDetails.stakeAmount), "ETH");
    console.log("Refund Amount:", hre.ethers.formatEther(gameDetails.refundAmount), "ETH");
    console.log("Refund Claimed:", gameDetails.refundClaimed);
    
    // Show staked OTOM IDs
    console.log("Staked OTOM IDs:");
    for (let i = 0; i < gameDetails.stakedOtomIds.length; i++) {
      console.log(`  OTOM ${i}: ${gameDetails.stakedOtomIds[i].toString()}`);
    }
    
    // Show OTOM masses
    console.log("OTOM Masses:");
    for (let i = 0; i < gameDetails.otomMasses.length; i++) {
      console.log(`  Mass ${i}: ${gameDetails.otomMasses[i].toString()}`);
    }
    
  } catch (error) {
    console.log("❌ ERROR getting full game details:", error.message);
    return;
  }

  console.log("\n=== Step 3: Determine Next Action ===");
  
  try {
    const turnStatus = await otomDuel.getGameTurnStatus(GAME_ID);
    
    if (turnStatus.gameState == 0) { // WAITING
      console.log("🎯 Next Action: Game is waiting to start");
      console.log("   Player should call startGame()");
    } else if (turnStatus.gameState == 1) { // ACTIVE
      if (turnStatus.isAgentTurn) {
        if (!turnStatus.agentCommitted) {
          console.log("🎯 Next Action: Agent's turn to commit");
          console.log("   Agent should call agentPlay() with commit hash");
        } else if (!turnStatus.roundCompleted) {
          console.log("🎯 Next Action: Agent's turn to reveal");
          console.log("   Agent should call reveal() with action and secret");
        } else {
          console.log("🎯 Next Action: Round completed, agent starts next round");
          console.log("   Agent should call agentPlay() for next round");
        }
      } else {
        console.log("🎯 Next Action: Player's turn to play");
        console.log("   Player should call playerPlay() with action and OTOM index");
      }
    } else if (turnStatus.gameState == 2) { // COMPLETED
      console.log("🎯 Next Action: Game completed");
      console.log("   Player can call claimRefund() if not already claimed");
    } else if (turnStatus.gameState == 3) { // CANCELLED
      console.log("🎯 Next Action: Game cancelled");
    }
    
  } catch (error) {
    console.log("❌ ERROR determining next action:", error.message);
    return;
  }

  console.log("\n=== Summary ===");
  console.log("✅ Game turn status checked successfully");
  console.log("✅ Use this information to determine whose turn it is");
  console.log("✅ Follow the 'Next Action' guidance above");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 