const hre = require("hardhat");
const { config } = require("./config");

async function main() {
  // Configuration
  const OTOM_DUEL_ADDRESS = config.OTOM_DUEL_ADDRESS;
  const GAME_ID = 1; // TODO: Replace with actual game ID

  console.log("=== View Game Actions ===");
  console.log("Game ID:", GAME_ID);

  // Get contract instance
  const otomDuel = await hre.ethers.getContractAt("OtomDuel", OTOM_DUEL_ADDRESS);

  try {
    const actions = await otomDuel.getGameActions(GAME_ID);
    const playerActions = actions[0];
    const agentActions = actions[1];
    const otomIndices = actions[2];
    const otomMasses = actions[3];
    
    console.log("\n=== Game Actions Summary ===");
    
    for (let i = 0; i < 3; i++) {
      console.log(`\n--- Round ${i} ---`);
      
      // Player action
      let playerActionName;
      switch (playerActions[i]) {
        case 0: playerActionName = "NONE (not played)"; break;
        case 1: playerActionName = "ATTACK"; break;
        case 2: playerActionName = "CHARGE"; break;
        default: playerActionName = "Unknown"; break;
      }
      console.log(`Player: ${playerActionName}`);
      
      // Agent action
      let agentActionName;
      switch (agentActions[i]) {
        case 0: agentActionName = "NONE (not revealed)"; break;
        case 1: agentActionName = "DEFEND"; break;
        case 2: agentActionName = "FLIP_CHARGE"; break;
        case 3: agentActionName = "RECOVER"; break;
        default: agentActionName = "Unknown"; break;
      }
      console.log(`Agent: ${agentActionName}`);
      
      // OTOM index and mass
      console.log(`OTOM ${i} Mass: ${otomMasses[i]}`);
      if (otomIndices[i] == 255) {
        console.log(`OTOM Index Used: Not used yet`);
      } else {
        console.log(`OTOM Index Used: ${otomIndices[i]}`);
      }
    }
    
    console.log("\n=== Action Codes ===");
    console.log("Player Actions: 0=NONE, 1=ATTACK, 2=CHARGE");
    console.log("Agent Actions: 0=NONE, 1=DEFEND, 2=FLIP_CHARGE, 3=RECOVER");
    console.log("OTOM Indices: 0-2=OTOM index used (0=first OTOM, 1=second OTOM, 2=third OTOM), 255=Not used");
    
  } catch (error) {
    console.log("❌ ERROR:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 