const hre = require("hardhat");
const { config } = require("./config");

async function main() {
  // Configuration
  const OTOM_DUEL_ADDRESS = config.OTOM_DUEL_ADDRESS;
  const GAME_ID = 1; // TODO: Replace with actual game ID

  console.log("=== Check Whose Turn ===");
  console.log("Game ID:", GAME_ID);

  // Get contract instance
  const otomDuel = await hre.ethers.getContractAt("OtomDuel", OTOM_DUEL_ADDRESS);

  try {
    const turnInfo = await otomDuel.whoseTurn(GAME_ID);
    const round = turnInfo[0];
    const turnStatus = turnInfo[1];
    
    console.log("Round:", round.toString());
    console.log("Turn Status:", turnStatus.toString());
    
    if (round == 4) {
      console.log("🎯 Game completed (refund available)");
    } else if (round == 5) {
      console.log("🎯 Game completed (refund claimed)");
    } else {
      switch (turnStatus) {
        case 0:
          console.log("🎯 AGENT needs to commit");
          break;
        case 1:
          console.log("🎯 PLAYER needs to play");
          break;
        case 2:
          console.log("🎯 AGENT needs to reveal");
          break;
        default:
          console.log("🎯 Unknown status");
          break;
      }
    }
    
  } catch (error) {
    console.log("❌ ERROR:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 