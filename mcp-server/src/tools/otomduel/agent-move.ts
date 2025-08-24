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
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "player",
        type: "address"
      }
    ],
    name: "playerActiveGame",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
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
      },
      {
        internalType: "uint256",
        name: "round",
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
    name: "validReveal",
    outputs: [
      {
        internalType: "bool",
        name: "",
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
      },
      {
        internalType: "uint256",
        name: "round",
        type: "uint256"
      }
    ],
    name: "getCommitHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

export const schema = {
  playerAddress: z
    .string()
    .describe('The address of the player in the game'),
  action: z
    .enum(['DEFEND', 'FLIP_CHARGE', 'RECOVER'])
    .describe('The agent action to perform'),
};

export const metadata = {
  name: 'agentMove',
  description: 'Make an agent move in an OtomDuel game (commit or reveal) using the agent wallet. Game ID is automatically inferred from the player address.',
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
    console.log('Agent Move - Input:', input);
    const { playerAddress, action } = input;

    console.log('Agent Move - Player Address:', playerAddress);
    console.log('Agent Move - Action:', action);

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

    // Infer gameId from playerAddress
    console.log('Inferring gameId from playerAddress...');
    const gameId = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'playerActiveGame',
      args: [playerAddress as `0x${string}`],
    });

    console.log('Inferred gameId:', gameId.toString());

    // Check if player has an active game
    if (gameId === BigInt(0)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'No active game found for this player',
              playerAddress: playerAddress,
              instructions: 'Player needs to start a game first',
            }),
          },
        ],
      };
    }

    console.log(`Agent Move - Game ${gameId.toString()}, Action: ${action}`);
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

    // Infer move type from game status
    let moveType: 'COMMIT' | 'REVEAL';
    if (turnStatus === BigInt(0)) {
      moveType = 'COMMIT';
    } else if (turnStatus === BigInt(2)) {
      moveType = 'REVEAL';
    } else {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'Not agent\'s turn to make a move',
              currentRound: Number(round),
              turnStatus: Number(turnStatus),
              instructions: 'Agent can only move when turnStatus is 0 (commit) or 2 (reveal)',
            }),
          },
        ],
      };
    }

    console.log(`Inferred move type: ${moveType}`);

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
    let correctAction: string | null = null;

    if (moveType === 'COMMIT') {
      // Use fixed secret for testing
      const moveSecret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      // Create commit hash: keccak256(action + secret + round)
      const actionValue = AGENT_ACTIONS[action];
      // Use the same packing method as the contract: keccak256(abi.encodePacked(action, secret, round))
      // Use encodePacked to replicate solidityPacked
      const { encodePacked } = await import('viem');
      const commitData = encodePacked(
        ['uint8', 'bytes32', 'uint256'],
        [actionValue, moveSecret as `0x${string}`, currentRound]
      );
      const commitHash = keccak256(commitData);
      console.log(`Committing - Action:  (${actionValue})`);
      console.log(`Committing - Secret: ${moveSecret}`);
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
      
      // Wait for transaction confirmation
      console.log('Waiting for transaction confirmation...');
      await publicClient.waitForTransactionReceipt({ hash });
      console.log('Transaction confirmed!');

    } else if (moveType === 'REVEAL') {
      // Use fixed secret for testing
      const moveSecret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      // Find the correct action by enumerating all possibilities
      console.log('Finding correct action for reveal...');
      const actions = ['DEFEND', 'FLIP_CHARGE', 'RECOVER'] as const;
      let correctAction: string | null = null;
      
      for (const testAction of actions) {
        const actionValue = AGENT_ACTIONS[testAction as keyof typeof AGENT_ACTIONS];
        const isValid = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: otomDuelAbi,
          functionName: 'validReveal',
          args: [BigInt(gameId), BigInt(currentRound), actionValue, moveSecret as `0x${string}`],
        });
        
        if (isValid) {
          correctAction = testAction;
          console.log(`Found correct action: ${correctAction}`);
          break;
        }
      }
      
      if (!correctAction) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: true,
                message: 'Could not find valid action for reveal',
                gameId: gameId.toString(),
                currentRound: Number(currentRound),
                instructions: 'Check if the secret matches the committed action',
              }),
            },
          ],
        };
      }
      
      const actionValue = AGENT_ACTIONS[correctAction as keyof typeof AGENT_ACTIONS];
      console.log(`Revealing - Action: ${correctAction} (${actionValue}), Secret: ${moveSecret}`);

      // Prepare transaction data
      const transactionData = encodeFunctionData({
        abi: otomDuelAbi,
        functionName: 'reveal',
        args: [BigInt(gameId), actionValue, moveSecret as `0x${string}`],
      });

      // Send transaction
      const hash = await walletClient.sendTransaction({
        to: contractAddress as `0x${string}`,
        data: transactionData,
      });

      transactionHash = hash;
      actionDescription = `Revealed ${correctAction} for round ${Number(currentRound)}`;
      
      // Wait for transaction confirmation
      console.log('Waiting for transaction confirmation...');
      await publicClient.waitForTransactionReceipt({ hash });
      console.log('Transaction confirmed!');
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
      gameId: gameId.toString(),
      agentAddress: agentAccount.address,
      moveType: moveType,
      transactionHash: transactionHash,
      actionDescription: actionDescription,
      chainId: chain.id,
      explorerUrl: `https://sepolia.shapescan.xyz/tx/${transactionHash}`,
      // Only include action in response for REVEAL operations
      ...(moveType === 'REVEAL' && { action: correctAction || action }),
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
        ? [
            'Agent move committed successfully!',
            'Next: Player should call preparePlayerMove() with their action and OTOM index',
            'Note: Wait a few seconds for blockchain confirmation before player move'
          ]
        : [
            'Agent move revealed successfully!',
            'Next: If game is not complete, agent should call agentMove() for next round',
            'Note: Wait a few seconds for blockchain confirmation before next move'
          ],
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
            playerAddress: input.playerAddress,
            action: input.action,
            instructions: 'Check game status and ensure it\'s the agent\'s turn',
          }),
        },
      ],
    };
  }
} 