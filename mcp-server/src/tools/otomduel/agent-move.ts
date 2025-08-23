import { z } from 'zod';
import { InferSchema } from 'xmcp';
import { createWalletClient, http, createPublicClient, encodeFunctionData, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { shape, shapeSepolia } from 'viem/chains';
import { config } from '../../config';
import { addresses } from '../../addresses';

// Agent action enum mapping
const AGENT_ACTIONS = {
  DEFEND: 1,
  FLIP_CHARGE: 2,
  RECOVER: 3,
} as const;

// OtomDuel contract ABI for agent functions
const otomDuelAbi = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256"
      },
      {
        internalType: "bytes32",
        name: "commitHash",
        type: "bytes32"
      }
    ],
    name: "agentPlay",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256"
      },
      {
        internalType: "enum OtomDuel.AgentAction",
        name: "action",
        type: "uint8"
      },
      {
        internalType: "bytes32",
        name: "secret",
        type: "bytes32"
      }
    ],
    name: "reveal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256"
      }
    ],
    name: "getGame",
    outputs: [
      {
        internalType: "address",
        name: "player",
        type: "address"
      },
      {
        internalType: "uint256[]",
        name: "stakedOtomIds",
        type: "uint256[]"
      },
      {
        internalType: "uint256[]",
        name: "otomMasses",
        type: "uint256[]"
      },
      {
        internalType: "uint256",
        name: "agentHealth",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "currentRound",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "accumulatedCharge",
        type: "uint256"
      },
      {
        internalType: "enum OtomDuel.GameState",
        name: "state",
        type: "uint8"
      },
      {
        internalType: "uint256",
        name: "stakeAmount",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "refundAmount",
        type: "uint256"
      },
      {
        internalType: "bool",
        name: "refundClaimed",
        type: "bool"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256"
      }
    ],
    name: "whoseTurn",
    outputs: [
      {
        internalType: "uint256",
        name: "round",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "turnStatus",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    name: "whitelistedAgents",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

export const schema = {
  gameId: z
    .string()
    .describe('The game ID to make a move for'),
  action: z
    .enum(['DEFEND', 'FLIP_CHARGE', 'RECOVER'])
    .describe('The agent action to perform'),
  moveType: z
    .enum(['COMMIT', 'REVEAL'])
    .describe('Whether to commit a new move or reveal a previous commit'),
  secret: z
    .string()
    .optional()
    .describe('The secret for reveal (required for REVEAL, auto-generated for COMMIT)'),
};

export const metadata = {
  name: 'agentMove',
  description: 'Make an agent move in an OtomDuel game (commit or reveal) using the agent wallet',
  inputSchema: schema,
  annotations: {
    title: 'Agent Move',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    requiresWallet: true,
    category: 'otomduel',
    educationalHint: true,
  },
};

export default async function agentMove(input: InferSchema<typeof schema>) {
  try {
    const { gameId, action, moveType, secret } = input;

    // Check if agent private key is available
    const agentPrivateKey = config.agentPrivateKey;
    
    if (!agentPrivateKey) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'AGENT_PRIVATE_KEY not set in environment variables',
              instructions: 'Please set AGENT_PRIVATE_KEY in your .env file (with or without 0x prefix)',
              debug: {
                configExists: !!config.agentPrivateKey,
                configLength: config.agentPrivateKey?.length,
                configStartsWith0x: config.agentPrivateKey?.startsWith('0x'),
              },
            }),
          },
        ],
      };
    }

    // Normalize private key format (add 0x if missing)
    const normalizedPrivateKey = (agentPrivateKey.startsWith('0x') 
      ? agentPrivateKey 
      : `0x${agentPrivateKey}`) as `0x${string}`;

    // Create agent account and clients
    const agentAccount = privateKeyToAccount(normalizedPrivateKey);
    const chain = config.isMainnet ? shape : shapeSepolia;
    const contractAddress = addresses.otomDuel[chain.id];

    const publicClient = createPublicClient({
      chain,
      transport: http(config.defaultRpcUrl),
    });

    const walletClient = createWalletClient({
      account: agentAccount,
      chain,
      transport: http(config.defaultRpcUrl),
    });

    console.log(`Agent Move - Game ${gameId}, Action: ${action}, Type: ${moveType}`);
    console.log(`Agent Address: ${agentAccount.address}`);
    console.log(`Contract Address: ${contractAddress}`);

    // Check agent whitelist
    const isWhitelisted = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'whitelistedAgents',
      args: [agentAccount.address],
    });

    if (!isWhitelisted) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'Agent is not whitelisted',
              agentAddress: agentAccount.address,
              instructions: 'Contact the contract owner to whitelist this agent address',
            }),
          },
        ],
      };
    }

    // Check game status
    const [round, turnStatus] = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'whoseTurn',
      args: [BigInt(gameId)],
    });

    console.log(`Game Status - Round: ${round}, Turn Status: ${turnStatus}`);

    // Validate turn
    if (moveType === 'COMMIT' && turnStatus !== BigInt(0)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'Not agent\'s turn to commit',
              currentRound: Number(round),
              turnStatus: Number(turnStatus),
              instructions: 'Agent can only commit when turnStatus is 0 (agent needs to commit)',
            }),
          },
        ],
      };
    }

    if (moveType === 'REVEAL' && turnStatus !== BigInt(2)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'Not agent\'s turn to reveal',
              currentRound: Number(round),
              turnStatus: Number(turnStatus),
              instructions: 'Agent can only reveal when turnStatus is 2 (agent needs to reveal)',
            }),
          },
        ],
      };
    }

    // Get game details for current round
    const [
      player,
      stakedOtomIds,
      otomMasses,
      agentHealth,
      currentRound,
      accumulatedCharge,
      state,
      stakeAmount,
      refundAmount,
      refundClaimed
    ] = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'getGame',
      args: [BigInt(gameId)],
    });

    console.log(`Game Details - Round: ${currentRound}, Health: ${agentHealth}, State: ${state}`);

    let transactionHash: string = '';
    let actionDescription: string = '';

    if (moveType === 'COMMIT') {
      // Use fixed secret for testing
      const moveSecret = secret || '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      // Create commit hash: keccak256(action + secret + round)
      const actionValue = AGENT_ACTIONS[action];
      // Use the same packing method as the contract: keccak256(abi.encodePacked(action, secret, round))
      // Replicate abi.encodePacked by concatenating the raw bytes
      const actionBytes = toHex(actionValue).slice(2).padStart(64, '0'); // 32 bytes for uint8
      const secretBytes = moveSecret.slice(2); // 32 bytes for bytes32
      const roundBytes = toHex(currentRound).slice(2).padStart(64, '0'); // 32 bytes for uint256
      const commitData = ('0x' + actionBytes + secretBytes + roundBytes) as `0x${string}`;
      const commitHash = keccak256(commitData);

      console.log(`Committing - Action: ${action} (${actionValue}), Secret: ${moveSecret}`);
      console.log(`Commit Hash: ${commitHash}`);

      // Prepare transaction data
      const transactionData = encodeFunctionData({
        abi: otomDuelAbi,
        functionName: 'agentPlay',
        args: [BigInt(gameId), commitHash],
      });

      // Send transaction
      const hash = await walletClient.sendTransaction({
        to: contractAddress as `0x${string}`,
        data: transactionData,
      });

      transactionHash = hash;
      actionDescription = `Committed move for round ${Number(currentRound)}`;

    } else if (moveType === 'REVEAL') {
      if (!secret) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: true,
                message: 'Secret is required for reveal',
                instructions: 'Provide the secret that was used in the commit',
              }),
            },
          ],
        };
      }

      const actionValue = AGENT_ACTIONS[action];
      console.log(`Revealing - Action: ${action} (${actionValue}), Secret: ${secret}`);

      // Prepare transaction data
      const transactionData = encodeFunctionData({
        abi: otomDuelAbi,
        functionName: 'reveal',
        args: [BigInt(gameId), actionValue, secret as `0x${string}`],
      });

      // Send transaction
      const hash = await walletClient.sendTransaction({
        to: contractAddress as `0x${string}`,
        data: transactionData,
      });

      transactionHash = hash;
      actionDescription = `Revealed ${action} for round ${Number(currentRound)}`;
    }

    // Get updated game status
    const [updatedRound, updatedTurnStatus] = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'whoseTurn',
      args: [BigInt(gameId)],
    });

    const [
      updatedPlayer,
      updatedStakedOtomIds,
      updatedOtomMasses,
      updatedAgentHealth,
      updatedCurrentRound,
      updatedAccumulatedCharge,
      updatedState,
      updatedStakeAmount,
      updatedRefundAmount,
      updatedRefundClaimed
    ] = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'getGame',
      args: [BigInt(gameId)],
    });

    const result = {
      success: true,
      message: `Agent move executed successfully`,
      gameId: gameId,
      agentAddress: agentAccount.address,
      moveType: moveType,
      transactionHash: transactionHash,
      actionDescription: actionDescription,
      chainId: chain.id,
      explorerUrl: `https://sepolia.shapescan.xyz/tx/${transactionHash}`,
      // Only include action in response for REVEAL operations
      ...(moveType === 'REVEAL' && { action: action }),
      gameStatus: {
        before: {
          round: Number(round),
          turnStatus: Number(turnStatus),
          agentHealth: Number(agentHealth),
          currentRound: Number(currentRound),
          gameState: Number(state),
        },
        after: {
          round: Number(updatedRound),
          turnStatus: Number(updatedTurnStatus),
          agentHealth: Number(updatedAgentHealth),
          currentRound: Number(updatedCurrentRound),
          gameState: Number(updatedState),
        },
      },
      nextSteps: moveType === 'COMMIT' 
        ? ['Player should call playerPlay() with their action and OTOM index']
        : ['If game is not complete, agent should call agentPlay() for next round'],
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };

  } catch (error) {
    console.error('Agent move error:', error);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: `Error executing agent move: ${error instanceof Error ? error.message : 'Unknown error'}`,
            gameId: input.gameId,
            moveType: input.moveType,
            // Only include action in error response for REVEAL operations
            ...(input.moveType === 'REVEAL' && { action: input.action }),
            instructions: 'Check game status and ensure it\'s the agent\'s turn',
          }),
        },
      ],
    };
  }
} 