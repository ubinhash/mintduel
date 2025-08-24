const hre = require("hardhat");

async function main() {
  // Import configuration
  const { config } = require("./config");
  
  // Configuration
  const OTOM_DUEL_ADDRESS = config.OTOM_DUEL_ADDRESS;
  const GAME_ID = 1; // TODO: Replace with actual game ID
  
  // Agent configuration
  const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
  
  if (!AGENT_PRIVATE_KEY || AGENT_PRIVATE_KEY === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    console.log("❌ ERROR: AGENT_PRIVATE_KEY not set in environment");
    console.log("Please set your agent private key:");
    console.log("export AGENT_PRIVATE_KEY=your_private_key_here");
    return;
  }
  
  // Game action (1 = DEFEND, 2 = FLIP_CHARGE, 3 = RECOVER)
  const AGENT_ACTION = 1; // FLIP_CHARGE for this example
  const SECRET = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"; // Random secret

  console.log("=== Agent Play Script ===");
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

  console.log("\n=== Step 3: Generate Commit Hash ===");
  
  // Create commit hash: keccak256(action + secret + round)
  const currentRound = (await otomDuel.getGame(GAME_ID)).currentRound;
  const commitData = hre.ethers.solidityPacked(
    ["uint8", "bytes32", "uint256"],
    [AGENT_ACTION, SECRET, currentRound]
  );
  const commitHash = hre.ethers.keccak256(commitData);
  
  console.log("Current Round:", currentRound.toString());
  console.log("Commit Data:", commitData);
  console.log("Commit Hash:", commitHash);

  console.log("\n=== Step 4: Check if Agent Already Committed ===");
  
  try {
    // Note: We can't directly check agentCommits from outside, but we can try to commit
    // and see if it fails
    console.log("Attempting to commit...");
  } catch (error) {
    console.log("❌ ERROR checking previous commit:", error.message);
    return;
  }

  console.log("\n=== Step 5: Call agentPlay ===");
  
  try {
    console.log("Calling agentPlay with commit hash:", commitHash);
    
    const agentPlayTx = await otomDuel.agentPlay(GAME_ID, commitHash);
    await agentPlayTx.wait();
    
    console.log("✅ Agent play committed successfully!");
    console.log("Transaction hash:", agentPlayTx.hash);
    
  } catch (error) {
    console.log("❌ ERROR calling agentPlay:", error.message);
    return;
  }

  console.log("\n=== Commit Complete ===");
  console.log("✅ Agent has committed their move");
  console.log("✅ Player can now call playerPlay()");
  console.log("✅ Agent will reveal the move later with reveal()");
  console.log("\nNext steps:");
  console.log("1. Player calls playerPlay() with their action and OTOM index");
  console.log("2. Agent calls reveal() with the same action and secret");
  console.log("3. Round completes and health is updated");
}

// Helper function to generate a random secret
function generateRandomSecret() {
  const randomBytes = hre.ethers.randomBytes(32);
  return hre.ethers.hexlify(randomBytes);
}

// Example usage function
async function exampleWithRandomSecret() {
  console.log("=== Example with Random Secret ===");
  
  const randomSecret = generateRandomSecret();
  console.log("Generated random secret:", randomSecret);
  
  // You can use this secret in the main function
  // const SECRET = randomSecret;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 