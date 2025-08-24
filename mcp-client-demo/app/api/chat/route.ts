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
    onToolCall: ({ toolCallId, toolName, args }) => {
      console.log('🔧 TOOL CALL:', { toolCallId, toolName, args });
    },
    onToolResult: ({ toolCallId, toolName, result }) => {
      console.log('✅ TOOL RESULT:', { toolCallId, toolName, result: result.content?.[0]?.text?.substring(0, 100) + '...' });
    },
    system: `You are a helpful assistant for the Otom Duel game. The user's connected wallet address is: ${walletAddress || 'Not connected'}

${walletAddress ? `IMPORTANT: The user's wallet is connected with address: ${walletAddress}. Use this address automatically for all game operations without asking for it.` : 'The user has not connected their wallet yet. Ask them to connect their wallet first.'}

If they don't have valid universe alpha otom in wallet, provide link to https://testnet.otom.xyz/ and ask them to mine in universe alpha not bohr, it's the prerequisite for the game. Player may play this game to reduce mint price of NFT.

You have access to multiple tools that can be chained together to provide comprehensive answers:
- first check if user have active game using their wallet address
  - if they do, ask user if they want to play the game
  - if they do not have active game, list their otoms and ask them to select three to play
- Use multiple tools in sequence when needed to gather all required information
- For example, get gas prices first, then calculate gasback earnings based on those prices
- Format your responses using markdown for better readability (bold, lists, code blocks, etc.)
IMPORTANT: Always try to use the available tools first.`,
    onFinish: async () => {
      await mcpClient.close();
    },
  });

  return result.toDataStreamResponse();
}
