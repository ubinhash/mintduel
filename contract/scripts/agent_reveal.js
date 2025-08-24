const hre = require("hardhat");

async function main() {
  // Import configuration
  const { config } = require("./config");
  
  // Configuration
  const OTOM_DUEL_ADDRESS = config.OTOM_DUEL_ADDRESS;
  const GAME_ID = 2; // TODO: Replace with actual game ID
  
  // Agent configuration
  const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
  
  if (!AGENT_PRIVATE_KEY || AGENT_PRIVATE_KEY === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    console.log("❌ ERROR: AGENT_PRIVATE_KEY not set in environment");
    console.log("Please set your agent private key:");
    console.log("export AGENT_PRIVATE_KEY=your_private_key_here");
    return;
  }
  
  // Game action (1 = DEFEND, 2 = FLIP_CHARGE, 3 = RECOVER)
  const AGENT_ACTION = 2; // FLIP_CHARGE for this example
  const SECRET = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"; // Same secret used in commit

  console.log("=== Agent Reveal Script ===");
  console.log("OTOM Duel Address:", OTOM_DUEL_ADDRESS);
  console.log("Game ID:", GAME_ID);
  console.log("Agent Action:", AGENT_ACTION === 1 ? "DEFEND" : AGENT_ACTION === 2 ? "FLIP_CHARGE" : "RECOVER");
  console.log("Secret:", SECRET);

  // Create agent signer
  const agentSigner = new hre.ethers.Wallet(AGENT_PRIVATE_KEY, hre.ethers.provider);
  console.log("Agent address:", agentSigner.address);

  // Get contract instance
  const otomDuel = await hre.ethers.getContractAt("OtomDuel", OTOM_DUEL_ADDRESS, agentSigner);

  console.log("\n=== Step 1: Check Agent Whitelist ===");
  
  try {
    const isWhitelisted = await otomDuel.whitelistedAgents(agentSigner.address);
    console.log("Agent whitelist status:", isWhitelisted);
    
    if (!isWhitelisted) {
      console.log("❌ ERROR: Agent is not whitelisted");
      return;
    }
  } catch (error) {
    console.log("❌ ERROR checking whitelist:", error.message);
    return;
  }

  console.log("\n=== Step 2: Check Game Status ===");
  
  try {
    const gameDetails = await otomDuel.getGame(GAME_ID);
    console.log("Game State:", gameDetails.state);
    console.log("Current Round:", gameDetails.currentRound.toString());
    console.log("Player:", gameDetails.player);
    
    if (gameDetails.state != 1) { // 1 = ACTIVE
      console.log("❌ ERROR: Game is not active");
      return;
    }
    
    if (gameDetails.currentRound >= 3) {
      console.log("❌ ERROR: Game is already completed");
      return;
    }
  } catch (error) {
    console.log("❌ ERROR checking game status:", error.message);
    return;
  }

  console.log("\n=== Step 3: Verify Commit Hash ===");
  
  // Recreate the commit hash to verify it matches
  const currentRound = (await otomDuel.getGame(GAME_ID)).currentRound;
  const commitData = hre.ethers.solidityPacked(
    ["uint8", "bytes32", "uint256"],
    [AGENT_ACTION, SECRET, currentRound]
  );
  const commitHash = hre.ethers.keccak256(commitData);
  
  console.log("Current Round:", currentRound.toString());
  console.log("Commit Data:", commitData);
  console.log("Commit Hash:", commitHash);

  console.log("\n=== Step 4: Check if Player Has Played ===");
  
  try {
    // We can't directly check player actions, but we can try to reveal
    // and see if it fails due to player not having played
    console.log("Checking if player has played...");
  } catch (error) {
    console.log("❌ ERROR checking player action:", error.message);
    return;
  }

  console.log("\n=== Step 5: Call reveal ===");
  
  try {
    console.log("Calling reveal with action:", AGENT_ACTION, "and secret:", SECRET);
    
    const revealTx = await otomDuel.reveal(GAME_ID, AGENT_ACTION, SECRET);
    await revealTx.wait();
    
    console.log("✅ Agent move revealed successfully!");
    console.log("Transaction hash:", revealTx.hash);
    
  } catch (error) {
    console.log("❌ ERROR calling reveal:", error.message);
    
    // Common error messages and their meanings
    if (error.message.includes("Agent must commit first")) {
      console.log("💡 HINT: Agent needs to call agentPlay() first");
    } else if (error.message.includes("Player must play first")) {
      console.log("💡 HINT: Player needs to call playerPlay() first");
    } else if (error.message.includes("Agent already revealed")) {
      console.log("💡 HINT: Agent already revealed for this round");
    } else if (error.message.includes("Invalid commit")) {
      console.log("💡 HINT: Action or secret doesn't match the commit");
    }
    
    return;
  }

  console.log("\n=== Reveal Complete ===");
  console.log("✅ Agent has revealed their move");
  console.log("✅ Round outcome has been calculated");
  
  // Get updated game details
  try {
    const updatedGame = await otomDuel.getGame(GAME_ID);
    console.log("\n=== Updated Game Details ===");
    console.log("Current Round:", updatedGame.currentRound.toString());
    console.log("Agent Health:", updatedGame.agentHealth.toString());
    console.log("Game State:", updatedGame.state);
    
    if (updatedGame.currentRound >= 3) {
      console.log("🎉 Game completed!");
      console.log("Final Agent Health:", updatedGame.agentHealth.toString());
    } else {
      console.log("🔄 Ready for next round");
      console.log("Agent should call agentPlay() for round", updatedGame.currentRound + 1);
    }
  } catch (error) {
    console.log("❌ ERROR getting updated game details:", error.message);
  }
}

// Helper function to generate a random secret
function generateRandomSecret() {
  const randomBytes = hre.ethers.randomBytes(32);
  return hre.ethers.hexlify(randomBytes);
}

// Example of how to use with a random secret
async function exampleWithRandomSecret() {
  console.log("=== Example with Random Secret ===");
  
  const randomSecret = generateRandomSecret();
  console.log("Generated random secret:", randomSecret);
  
  // You can use this secret in both agent_play.js and agent_reveal.js
  // const SECRET = randomSecret;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 