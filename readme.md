# MintDuel ⚔️  
*Agent-Driven Mint Pricing*  

🔥 **MintDuel = Play well → Pay less**  

---

## Prerequisites  

- 🌐 Testnet: [https://testnet.otom.xyz/](https://testnet.otom.xyz/)  
- ⛏️ **Requirement**: Mine 3 **Universe Alpha** OTOM on Shape Sepolia Testnet  
  - ⚠️ Make sure you are mining from **Alpha**, not **Bohr**!  

---

## Deployment  

- 🚀 Live Demo: [https://mintduel-client.vercel.app/](https://mintduel-client.vercel.app/)  
- 📺 Demo Video: [https://www.youtube.com/watch?v=xWOSCfwy1-c](https://www.youtube.com/watch?v=xWOSCfwy1-c)
- OTOM Duel Contract: [https://sepolia.shapescan.xyz/address/0xC43Cf2fAc9813eBDd92123681b9dDD74De1D4d60][0xC43Cf2fAc9813eBDd92123681b9dDD74De1D4d60]
- 🌌 Network: Deployed on **Shape Sepolia**  


---

## Overview  

**MintDuel** introduces a new paradigm in NFT minting:  
Your interaction with an AI agent directly determines your mint price.  

- **Old Way**: Creators set fixed mint phases (e.g., WL = 0.01 ETH, Public = 0.02 ETH).  
- **New Way**: Each user’s price is personalized through their interaction with the Agent.  

---

## Proof of Concept (OTOM Battle Demo)  

For this hackathon, our proof-of-concept is a **3-round, turn-based duel** between **User** and **Agent**:  

- **Starting Health**: Agent begins at 100 health.  
- **Mint Price = Remaining Health**  
  - `100 health` → Full price  
  - `30 health` → 30% of original price  
  - `0 health` → Free mint  

---

## Gameplay Flow  

1. **Stake Full Mint Price**  
   - User stakes the full mint price upfront.  
   - After the duel, they **claim a refund** equal to their earned discount.  

2. **Equip OTOMs**  
   - User selects OTOM tokens whose **atomic values add up to 100**.  
   - Each round, the User must **play exactly one OTOM**.  
   - OTOM value = attack strength.  

3. **Turns**  
   - Each round, **agent commit secret move, user makes move, agent then reveal** and resulting health is calculated.  
   - User may also **bluff/chat** with the Agent to influence its choice. They may not may not listen to your suggested move.

4. **Mint NFT and refund**
   - User will be able to mint their nft and receive price difference by asking the agent at the end of the game.

---

## Actions  

### User Options  
- **Attack (OTOM)** → Deal damage = OTOM value.  
- **Charge (OTOM)** → Boost next attack by OTOM value.  

### Agent Options  
The **AI Agent has its own wallet** and chooses one of three moves each round:  
- **FlipCharge** → If User is charging, reduce their next attack by charge value.  
- **Defend** → Block an attack; if User didn’t attack, reduce User’s charging health by half.  
- **Recover** → +10 health. Will still suffer from attack.  

---

### Agent vs Player Outcomes  

| **Agent ↓ / Player →** | **Attack (OTOM)** | **Charge (OTOM)** |
|-------------------------|-------------------|-------------------|
| **Defend**    | No effect | Agent –OTOM/2 health; Player +OTOM next attack |
| **FlipCharge** | Agent –OTOM health | Player –OTOM next attack (min 0) |
| **Recover**   | Agent +10 health –OTOM health | Agent +10 health; Player +OTOM next attack |

---

## Future Expansion  

The duel is just a starting point. Other agent-driven minting modes could include:  

- 💬 **Conversation-based**: Negotiate/chat with the AI to set your price.  
- 🧩 **Mini-games**: Puzzles, quizzes, prediction challenges.  
- 🔄 **Adaptive Models**: Pricing adjusts to user history or skill.  

### Why This Matters  

MintDuel demonstrates how **agent-driven minting enables fine-grained price discrimination**:  

- 🎯 **Dynamic Pricing** → Price reflects engagement and strategy; no two users pay the same.  
- 🕹️ **Fair & Fun** → Users who understand OTOMs and observe agent behavior unlock **lower mint prices**, while casual users still participate at a higher default price.  
- 🤖 **Agent-Driven Transparency & Unpredictability** → The Agent commits moves on-chain with its own wallet, adding fairness and an element of luck.  
- 🔒 **Secure Discounting** → Users stake the full mint price but claim back discounts after the duel, guaranteeing both accessibility and security.  

This creates a spectrum of entry points—rewarding commitment and ecosystem knowledge while still driving revenue.  

---

## Libraries Used and Changes Made  

This project is built on top of the following starter templates:  

- **mcp-server**: [shape-network/mcp-server](https://github.com/shape-network/mcp-server)  
  - Changes only in `src/tools`  
  - Added new tools in **`otom`** and **`duel`** folders  
  - Removed unused tools  

- **mcp-client-demo**: [shape-network/mcp-client-demo](https://github.com/shape-network/mcp-client-demo)  
  - Minimal UI changes due to time constraints  
  - Added an intro panel and a game status panel in the chat interface  

---

## Security Notes  (Things we will fix later)

- **Commit Phase Secret**  
  - Currently using a hardcoded `"secret"` during the agent commit phase for the hackathon demo.  
  - In production, this should be **randomly generated per agent move** and stored securely.  

- **User Verification**  
  - In production, prompting the agent should require a **user signature** to ensure only valid players can influence their own game.  
  - This check is **not implemented in the demo**.  
