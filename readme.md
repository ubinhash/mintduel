# MintDuel ⚔️  
*Agent-Driven Mint Pricing*  

---

## Prerequisite 
https://testnet.otom.xyz/

mine three universe alpha otom on testnet, please make sure you are mining from alpha not bohr!


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

## Why MintDuel?  
- 🎯 **Dynamic Pricing** → No two users pay the same; price reflects engagement.  
- 🕹️ **Fair & Fun** → Users who understand OTOMs and strategize effectively earn discounts.  
- 🤖 **Agent-Driven** → The Agent commits on-chain with its own wallet, ensuring transparency.  
- 🔒 **Trustless Claim** → Users always stake the full mint price and claim back their discount after the duel.  

---

## Future Expansion  
The duel is just a starting point. Other agent-driven minting modes could include:  
- 💬 **Conversation-based**: Negotiate/chat with the AI to set your price.  
- 🧩 **Mini-games**: Puzzles, quizzes, prediction challenges.  
- 🔄 **Adaptive Models**: Pricing adjusts to user history or skill.  

---

## Library Used and Changed Made

The project is build upon the following starter template/files. I haven't made much change to the client demo UI due to time constraint.

mcp-server: https://github.com/shape-network/mcp-server
    + changes are only made in src/tools, created a new set of tools in otom and duel folders.
mcp-client-demo: https://github.com/shape-network/mcp-client-demo


## Other technical details on Security

We're using a hardcoded "secret" in the commit phase for the hackthon, it should be randomly generated each time agent commits a move and stored safely in prdocution.

When use prompt agent to move we should've asked for a signature from a user to ensure the user is player in the particular game to avoid the player from influencing other player's game in production. Here we're not performing this check in this demo. 








🔥 **MintDuel = Play well → Pay less**  
