import { z } from 'zod';
import { type InferSchema } from 'xmcp';
import { Address, zeroAddress } from 'viem';
import type { ToolErrorOutput } from '../../types';
import { addresses } from '../../addresses';
import { createPublicClient, http } from 'viem';
import { shapeSepolia } from 'viem/chains';

export const schema = {
  playerAddress: z
    .string()
    .describe('The address of the player to check game status for'),
};

export const metadata = {
  name: 'checkGameStatus',
  description: 'Check if a player has an active OtomDuel game and get current turn information',
  inputSchema: schema,
  annotations: {
    title: 'Check OtomDuel Game Status',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: false,
    category: 'otomduel',
    educationalHint: true,
  },
};

// Create public client for reading contract data
const publicClient = createPublicClient({
  chain: shapeSepolia,
  transport: http(),
});

// OtomDuel contract ABI for the functions we need
const otomDuelAbi = [
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
        internalType: "uint256",
        name: "gameId",
        type: "uint256"
      }
    ],
    name: "getGameActions",
    outputs: [
      {
        internalType: "uint256[]",
        name: "playerActions",
        type: "uint256[]"
      },
      {
        internalType: "uint256[]",
        name: "agentActions",
        type: "uint256[]"
      },
      {
        internalType: "uint256[]",
        name: "otomIndices",
        type: "uint256[]"
      },
      {
        internalType: "uint256[]",
        name: "otomMasses",
        type: "uint256[]"
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
  }
] as const;

export default async function checkGameStatus(params: InferSchema<typeof schema>) {
  try {
    const { playerAddress } = params;

    // Validate player address
    if (!playerAddress || playerAddress === zeroAddress) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'INVALID_PLAYER_ADDRESS',
              message: 'Invalid player address provided',
            }),
          },
        ],
      };
    }

    // Get OtomDuel contract address for Shape Sepolia (chainId 11011)
    const chainId = 11011; // Shape Sepolia
    const contractAddress = addresses.otomDuel[chainId];

    if (!contractAddress || contractAddress === zeroAddress) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'CONTRACT_NOT_DEPLOYED',
              message: `OtomDuel contract not available on chain ${chainId}`,
            }),
          },
        ],
      };
    }

    // Check if player has an active game
    const activeGameId = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'playerActiveGame',
      args: [playerAddress as `0x${string}`],
    });

    // If no active game (returns 0), return early
    if (activeGameId === BigInt(0)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              hasActiveGame: false,
              message: 'No active game found for this address',
              playerAddress,
              chainId,
              explorerUrl: `https://sepolia.shapescan.xyz/address/${contractAddress}`,
            }),
          },
        ],
      };
    }

    // If we have an active game, proceed to get game details
    const gameId = Number(activeGameId);
    console.log('Debug - gameId:', gameId);

    // Get turn information
    const [round, turnStatus] = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'whoseTurn',
      args: [BigInt(gameId)],
    });

    // Get game actions
    const [playerActions, agentActions, otomIndices, actionOtomMasses] = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'getGameActions',
      args: [BigInt(gameId)],
    });

    // Get game details
    const [
      player,
      stakedOtomIds,
      gameOtomMasses,
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

    // Parse turn status
    let turnDescription = '';
    let nextAction = '';
    
    if (round === BigInt(4)) {
      turnDescription = 'Game completed';
      nextAction = 'Game is finished';
    } else if (round === BigInt(5)) {
      turnDescription = 'Refund claimed';
      nextAction = 'Game is finished and refund has been claimed';
    } else {
      switch (Number(turnStatus)) {
        case 0:
          turnDescription = 'Agent needs to commit their move';
          nextAction = 'Waiting for agent to commit';
          break;
        case 1:
          turnDescription = 'Player needs to make their move';
          nextAction = 'Player should play their OTOM';
          break;
        case 2:
          turnDescription = 'Agent needs to reveal their move';
          nextAction = 'Waiting for agent to reveal';
          break;
        default:
          turnDescription = 'Unknown turn status';
          nextAction = 'Unknown action required';
      }
    }

    // Parse game state
    const gameState = Number(state);
    let stateDescription = '';
    switch (gameState) {
      case 0:
        stateDescription = 'WAITING';
        break;
      case 1:
        stateDescription = 'ACTIVE';
        break;
      case 2:
        stateDescription = 'COMPLETED';
        break;
      case 3:
        stateDescription = 'CANCELLED';
        break;
      default:
        stateDescription = 'UNKNOWN';
    }

    // Parse actions for display
    const actionNames = {
      player: ['NONE', 'ATTACK', 'CHARGE'],
      agent: ['NONE', 'DEFEND', 'FLIP_CHARGE', 'RECOVER']
    };

    const parsedActions = {
      playerActions: playerActions.map(action => actionNames.player[Number(action)] || 'UNKNOWN'),
      agentActions: agentActions.map(action => actionNames.agent[Number(action)] || 'UNKNOWN'),
      otomIndices: otomIndices.map(index => Number(index) === 255 ? 'NOT_USED' : Number(index)),
      otomMasses: actionOtomMasses.map(mass => Number(mass))
    };

    const result = {
      success: true,
      hasActiveGame: true,
      gameId: gameId,
      playerAddress,
      chainId,
      explorerUrl: `https://sepolia.shapescan.xyz/address/${contractAddress}`,
      gameStatus: {
        currentRound: Number(round),
        turnStatus: Number(turnStatus),
        turnDescription,
        nextAction,
        gameState: stateDescription,
        agentHealth: Number(agentHealth),
        accumulatedCharge: Number(accumulatedCharge),
        stakeAmount: Number(stakeAmount) / 1e18, // Convert from wei to ETH
        refundAmount: Number(refundAmount) / 1e18, // Convert from wei to ETH
        refundClaimed: refundClaimed,
      },
      gameActions: parsedActions,
      stakedOtoms: {
        otomIds: stakedOtomIds.map(id => id.toString()),
        otomMasses: gameOtomMasses.map(mass => Number(mass))
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorOutput: ToolErrorOutput = {
      error: true,
      message: `Error checking game status: ${
        error instanceof Error ? error.message : 'Unknown error occurred'
      }`,
      ownerAddress: params.playerAddress,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorOutput, null, 2),
        },
      ],
    };
  }
} 