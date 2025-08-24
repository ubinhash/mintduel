# MintDuel ⚔️  
*Agent-Driven Mint Pricing*  

---

## Prerequisite  

- 🌐 Testnet: [https://testnet.otom.xyz/](https://testnet.otom.xyz/)  
- ⛏️ **Requirement**: Mine 3 **Universe Alpha** OTOM on testnet  
  - ⚠️ Make sure you are mining from **Alpha**, not **Bohr**!  

---

## Deployment  

- 🚀 Live Demo: [https://mintduel-client.vercel.app/](https://mintduel-client.vercel.app/)  
- 🌌 Network: Deployed on **Shape Sepolia**  

## Overview  
**MintDuel** introduces a new paradigm in NFT minting:  
Your interaction with an AI agent directly determines your mint price.  

- **Old Way**: Creators set fixed mint phases (e.g., WL = 0.01 ETH, Public = 0.02 ETH).  
- **New Way**: Each user’s price is personalized through a duel with the Agent.  

---

## Proof of Concept (OTOM Battle Demo)  
Our proof-of-concept work for this hackathon is a **3-round, turn-based duel** between **User** and **Agent**.  

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
   - Each round, **User and Agent commit moves on-chain, then reveal**.  
   - User may also **bluff/chat** with the Agent to influence its choice.  

---

## Actions  

### User Options  
- **Attack (OTOM)** → Deal damage = OTOM value.  
- **Charge (OTOM)** → Boost next attack by OTOM value.  

### Agent Options  
The **AI Agent has its own wallet** and chooses one of three moves each round:  
- **FlipCharge** → If User is charging, reduce their next attack by charge value.  
- **Defend** → Block an attack; if User didn’t attack, reduce User’s charging health by half.  
- **Recover** → +10 health; if User is charging, also gain +User’s charge.  

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

- 🎯 **Dynamic Pricing** → Price you pay reflects your engagement and strategy.  
- 🕹️ **Fair & Fun** → Users who understand how to make reaction to craft **heavy OTOMs** and willing to observe agent behavior unlock **lower mint prices**, while more casual users still participate at a higher default price.  
- 🤖 **Agent-Driven Transparency and Unpredictability** → The Agent commits moves on-chain with its own wallet, also adds a layer of luck to mint.
- 🔒 **Secure Discounting** → Users always stake the full mint price but claim back their discount after the duel, guaranteeing both accessibility and security.  

This creates a spectrum of entry points—rewarding commitment and ecosystem knowledge while still driving revenue.  


# Libraries Used and Changes Made

This project is built on top of the following starter templates:

- **mcp-server**: [shape-network/mcp-server](https://github.com/shape-network/mcp-server)  
  - Changes were only made in `src/tools`  
  - Added a new set of tools under the **`otom`** and **`duel`** folders  
  - Unused tools are all removed

- **mcp-client-demo**: [shape-network/mcp-client-demo](https://github.com/shape-network/mcp-client-demo)  
  - Minimal changes were made to the demo UI due to time constraints  
  - We've added a basic intro panel and a game status panel to the chat interface

---

# Security Notes

- **Commit Phase Secret**  
  - Currently using a hardcoded `"secret"` during the commit phase for the hackathon demo.  
  - In production, this should be **randomly generated for each agent move** and **stored securely**.  

- **User Verification**  
  - When prompting an agent to move, we should require a **user signature**.  
  - This ensures that only the authenticated player of a given game can make moves, preventing other users from interfering.  
  - For this demo, the signature check is **not implemented**.  





🔥 **MintDuel = Play well → Pay less**  
