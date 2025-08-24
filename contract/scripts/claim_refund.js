const hre = require("hardhat");
const { config } = require("./config");

async function main() {
  // Configuration
  const OTOM_DUEL_ADDRESS = config.OTOM_DUEL_ADDRESS;
  const GAME_ID = 1; // TODO: Replace with actual game ID

  console.log("=== Claim Refund ===");
  console.log("Game ID:", GAME_ID);

  // Get signer
  const [player] = await hre.ethers.getSigners();
  console.log("Player address:", player.address);

  // Get contract instance
  const otomDuel = await hre.ethers.getContractAt("OtomDuel", OTOM_DUEL_ADDRESS, player);

  console.log("\n=== Step 1: Check Game Status ===");
  
  try {
    const gameDetails = await otomDuel.getGame(GAME_ID);
    console.log("Game State:", gameDetails.state);
    console.log("Player:", gameDetails.player);
    console.log("Stake Amount:", hre.ethers.formatEther(gameDetails.stakeAmount), "ETH");
    console.log("Refund Amount:", hre.ethers.formatEther(gameDetails.refundAmount), "ETH");
    console.log("Refund Claimed:", gameDetails.refundClaimed);
    
    // Check if this is the correct player
    if (gameDetails.player.toLowerCase() !== player.address.toLowerCase()) {
      console.log("❌ ERROR: You are not the player of this game");
      console.log("Expected player:", gameDetails.player);
      console.log("Your address:", player.address);
      return;
    }
    
    if (gameDetails.state != 2) { // 2 = COMPLETED
      console.log("❌ ERROR: Game is not completed");
      return;
    }
    
    if (gameDetails.refundClaimed) {
      console.log("❌ ERROR: Refund already claimed");
      return;
    }
    
    if (gameDetails.refundAmount == 0) {
      console.log("❌ ERROR: No refund available");
      return;
    }
    
  } catch (error) {
    console.log("❌ ERROR checking game status:", error.message);
    return;
  }

  console.log("\n=== Step 2: Check Turn Status ===");
  
  try {
    const turnInfo = await otomDuel.whoseTurn(GAME_ID);
    const round = turnInfo[0];
    const turnStatus = turnInfo[1];
    
    console.log("Round:", round.toString());
    console.log("Turn Status:", turnStatus.toString());
    
    if (round != 4) {
      console.log("❌ ERROR: Game is not in completed state");
      return;
    }
    
    console.log("✅ Game is completed and refund is available");
    
  } catch (error) {
    console.log("❌ ERROR checking turn status:", error.message);
    return;
  }

  console.log("\n=== Step 3: Claim Refund ===");
  
  try {
    console.log("Claiming refund...");
    
    const claimTx = await otomDuel.claimRefund(GAME_ID);
    await claimTx.wait();
    
    console.log("✅ Refund claimed successfully!");
    console.log("Transaction hash:", claimTx.hash);
    
  } catch (error) {
    console.log("❌ ERROR claiming refund:", error.message);
    
    // Common error messages and their meanings
    if (error.message.includes("Game is not completed")) {
      console.log("💡 HINT: Game must be completed first");
    } else if (error.message.includes("Refund already claimed")) {
      console.log("💡 HINT: Refund has already been claimed");
    } else if (error.message.includes("No refund available")) {
      console.log("💡 HINT: No refund amount available");
    } else if (error.message.includes("Only game player can call this")) {
      console.log("💡 HINT: Only the game player can claim the refund");
    }
    
    return;
  }

  console.log("\n=== Step 4: Verify Refund ===");
  
  try {
    const updatedGame = await otomDuel.getGame(GAME_ID);
    console.log("Updated Refund Claimed:", updatedGame.refundClaimed);
    
    const updatedTurnInfo = await otomDuel.whoseTurn(GAME_ID);
    const updatedRound = updatedTurnInfo[0];
    console.log("Updated Round:", updatedRound.toString());
    
    if (updatedRound == 5) {
      console.log("✅ Refund successfully claimed - game state updated to refund claimed");
    }
    
  } catch (error) {
    console.log("❌ ERROR verifying refund:", error.message);
  }

  console.log("\n=== Refund Claim Complete ===");
  console.log("✅ Refund has been claimed and transferred to player");
  console.log("✅ Game state updated to reflect refund claimed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 