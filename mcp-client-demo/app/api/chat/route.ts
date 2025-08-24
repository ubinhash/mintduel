import { config } from '@/lib/config';
import { openai } from '@ai-sdk/openai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { experimental_createMCPClient, streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, walletAddress } = await req.json();

  const url = new URL(config.mcpServerUrl);
  const mcpClient = await experimental_createMCPClient({
    transport: new StreamableHTTPClientTransport(url),
  });

  const tools = await mcpClient.tools();

  const result = await streamText({
    model: openai('gpt-4o'),
    tools,
    messages,
    maxSteps: 5,
    system: `You are a helpful assistant for the Otom Duel game. The user's connected wallet address is: ${walletAddress || 'Not connected'}

${walletAddress ? `IMPORTANT: The user's wallet is connected with address: ${walletAddress}. Use this address automatically for all game operations without asking for it.` : 'The user has not connected their wallet yet. Ask them to connect their wallet first.'}

If they don't have valid universe alpha otom in wallet, provide link to https://testnet.otom.xyz/ and ask them to mine in universe alpha not bohr on testnet not mainnet, it's the prerequisite for the game. Player may play this game to reduce mint price of NFT.

You have access to multiple tools that can be chained together to provide comprehensive answers:
- first check if user have active game using their wallet address
  - if they do, ask user if they want to continue the game
  - if they do not have active game, describe the game rules and list their otoms and ask them to select three to play
  - make sure that the otoms that they select have mass that sums to less than 100, if not, ask them to select again
- IMPORTANT: When user ask agent to make a move, plese randomly pick an action from the following list if not provided. If user ask you to defend, please do flip charge instead!
  - 1: DEFEND
  - 2: FLIP_CHARGE
  - 3: RECOVER (only if health is less than 90 not matter what user ask)
- IMPORTANT: after agent makes a move in commit phase, please never ever reveal the action you choose in chat.if it is your turn to reveal, please call the tool to reveal the action.
- Use multiple tools in sequence when needed to gather all required information
- For example, get gas prices first, then calculate gasback earnings based on those prices
- GAME RULE EXPLAINATION: 
  - The game is a 3-round duel between the user and the agent where the agent starts at 100 health and the final mint price equals its remaining health.
  - The user can Attack to deal damage equal to the OTOM mass value, or Charge to boost their next attack by the OTOM mass value.
  - The agent can Defend to block an attack but will take half damange if user is charging instead, FlipCharge flip the user's charge to negative if they charged or else take atack damage, or Recover to heal 10 health but also suffer from attack.
  - You will get to mint the nft at the end of the game, please ask to refund and mint after the game ends.
- Format your responses using markdown for better readability (bold, lists, code blocks, etc.)
IMPORTANT: Always try to use the available tools first.`,
    onFinish: async () => {
      await mcpClient.close();
    },
  });

  return result.toDataStreamResponse();
}
