import { z } from 'zod';
import { type InferSchema } from 'xmcp';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { shape, shapeSepolia } from 'viem/chains';
import { config } from '../../config';
import { addresses } from '../../addresses';

// Player action enum mapping
const PLAYER_ACTIONS = {
  ATTACK: 1,
  CHARGE: 2,
} as const;

// OtomDuel contract ABI for player functions
const otomDuelAbi = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256"
      },
      {
        internalType: "enum OtomDuel.PlayerAction",
        name: "action",
        type: "uint8"
      },
      {
        internalType: "uint256",
        name: "otomIndex",
        type: "uint256"
      }
    ],
    name: "playerPlay",
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
  }
] as const;

export const schema = {
  playerAddress: z.string().describe('The address of the player making the move'),
  action: z.enum(['ATTACK', 'CHARGE']).default('ATTACK').describe('The player action to perform (ATTACK or CHARGE). Defaults to ATTACK if not specified.'),
  otomIndex: z.number().min(0).max(2).default(0).describe('The index of the OTOM to use (0, 1, or 2). Defaults to 0 if not specified.'),
};

export const metadata = {
  name: 'preparePlayerMove',
  description: 'Prepare a transaction for the player to make their move in an OtomDuel game. Game ID is automatically inferred from the player address.',
  inputSchema: schema,
  annotations: {
    title: 'Prepare Player Move',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: true,
    category: 'otomduel',
    educationalHint: true,
    chainableWith: ['preparePlayerMove'],
  },
};

// Add a console log to see if this file is being loaded
console.log('📦 TOOL LOADED: preparePlayerMove');

export default async function preparePlayerMove(input: any) {
  console.log('🚀 TOOL CALLED: preparePlayerMove');
  console.log('📥 Raw input:', JSON.stringify(input, null, 2));
  console.log('📥 Input type:', typeof input);
  console.log('📥 Input keys:', Object.keys(input || {}));
  console.log('📅 Timestamp:', new Date().toISOString());
  
  try {
    const { playerAddress, action, otomIndex } = input;
    
    console.log('🔍 Extracted parameters:');
    console.log('  - playerAddress:', playerAddress, '(type:', typeof playerAddress, ')');
    console.log('  - action:', action, '(type:', typeof action, ')');
    console.log('  - otomIndex:', otomIndex, '(type:', typeof otomIndex, ')');

    console.log('=== Prepare Player Move Debug ===');
    console.log('Input:', { playerAddress, action, otomIndex });
    console.log('Config:', { 
      chainId: config.chainId, 
      isMainnet: config.isMainnet,
      defaultRpcUrl: config.defaultRpcUrl 
    });

    // Create public client
    const chain = config.isMainnet ? shape : shapeSepolia;
    const contractAddress = addresses.otomDuel[chain.id];

    const publicClient = createPublicClient({
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
              instructions: 'Start a new game first using prepareStartGame',
            }),
          },
        ],
      };
    }

    console.log('Chain:', chain.id, chain.name);
    console.log('Contract Address:', contractAddress);

    console.log(`Prepare Player Move - Game ${gameId}, Player: ${playerAddress}, Action: ${action}, OTOM Index: ${otomIndex}`);

    // Check game status and turn
    console.log('Calling whoseTurn...');
    const [round, turnStatus] = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'whoseTurn',
      args: [BigInt(gameId)],
    });

    console.log(`Game Status - Round: ${round}, Turn Status: ${turnStatus}`);

    // Validate it's player's turn (turnStatus should be 1 for player to play)
    if (turnStatus !== BigInt(1)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'Not player\'s turn to make a move',
              currentRound: Number(round),
              turnStatus: Number(turnStatus),
              turnDescription: turnStatus === BigInt(0) ? 'Agent needs to commit first' : 
                              turnStatus === BigInt(2) ? 'Agent needs to reveal' : 'Game completed or other state',
              instructions: 'Player can only play when turnStatus is 1 (player needs to play)',
            }),
          },
        ],
      };
    }

    // Get game details to validate player and check OTOM availability
    console.log('Calling getGame...');
    const [
      gamePlayer,
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

    console.log('Game details:', {
      gamePlayer,
      stakedOtomIds: stakedOtomIds.map(id => id.toString()),
      otomMasses: otomMasses.map(mass => Number(mass)),
      currentRound: Number(currentRound),
      state: Number(state)
    });

    // Validate player address
    if (gamePlayer.toLowerCase() !== playerAddress.toLowerCase()) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'Player address does not match game player',
              providedAddress: playerAddress,
              gamePlayer: gamePlayer,
              instructions: 'Use the address that started this game',
            }),
          },
        ],
      };
    }

    // Get game actions to check which OTOMs have been used
    console.log('Calling getGameActions...');
    const [playerActions, agentActions, usedOtomIndices, actionOtomMasses] = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'getGameActions',
      args: [BigInt(gameId)],
    });

    console.log('Game actions:', {
      playerActions: playerActions.map(action => Number(action)),
      agentActions: agentActions.map(action => Number(action)),
      usedOtomIndices: usedOtomIndices.map(index => Number(index)),
      actionOtomMasses: actionOtomMasses.map(mass => Number(mass))
    });

    // Check if the specified OTOM index has already been used
    const usedOtomIndicesSet = new Set(usedOtomIndices.map(index => Number(index)).filter(index => index !== 255));
    if (usedOtomIndicesSet.has(otomIndex)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'OTOM index has already been used',
              otomIndex: otomIndex,
              usedOtomIndices: Array.from(usedOtomIndicesSet),
              availableOtomIndices: [0, 1, 2].filter(index => !usedOtomIndicesSet.has(index)),
              instructions: 'Choose an OTOM index that hasn\'t been used yet',
            }),
          },
        ],
      };
    }

    // Check if player has already played this round
    const currentRoundIndex = Number(currentRound);
    if (currentRoundIndex < playerActions.length && playerActions[currentRoundIndex] !== BigInt(0)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'Player has already played this round',
              currentRound: currentRoundIndex,
              instructions: 'Wait for agent to reveal their move',
            }),
          },
        ],
      };
    }

    // Get OTOM details for the specified index
    const otomId = stakedOtomIds[otomIndex];
    const otomMass = otomMasses[otomIndex];

    if (!otomId || !otomMass) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'Invalid OTOM index',
              otomIndex: otomIndex,
              availableOtomIds: stakedOtomIds.map(id => id.toString()),
              availableOtomMasses: otomMasses.map(mass => Number(mass)),
              instructions: 'Choose a valid OTOM index (0, 1, or 2)',
            }),
          },
        ],
      };
    }

    // Prepare transaction data
    const actionValue = PLAYER_ACTIONS[action as keyof typeof PLAYER_ACTIONS];
    const transactionData = encodeFunctionData({
      abi: otomDuelAbi,
      functionName: 'playerPlay',
      args: [BigInt(gameId), actionValue, BigInt(otomIndex)],
    });

    console.log('Transaction prepared:', {
      action: action,
      actionValue: actionValue,
      otomIndex: otomIndex,
      otomId: otomId.toString(),
      otomMass: Number(otomMass),
      transactionData: transactionData
    });

    // Estimate gas (optional, but good for user experience)
    let estimatedGas = '0';
    try {
      const gasEstimate = await publicClient.estimateGas({
        account: playerAddress as `0x${string}`,
        to: contractAddress as `0x${string}`,
        data: transactionData,
      });
      estimatedGas = gasEstimate.toString();
      console.log('Gas estimate:', estimatedGas);
    } catch (error) {
      console.log('Could not estimate gas:', error);
      estimatedGas = '150000'; // Default estimate
    }

    const result = {
      success: true,
      message: 'Player move transaction prepared successfully',
      transaction: {
        to: contractAddress,
        data: transactionData,
        value: '0x0', // No ETH value needed for player move
      },
      metadata: {
        contractAddress: contractAddress,
        functionName: 'playerPlay',
        playerAddress: playerAddress,
        gameId: gameId.toString(),
        action: action,
        actionValue: actionValue,
        otomIndex: otomIndex,
        otomId: otomId.toString(),
        otomMass: Number(otomMass),
        currentRound: Number(currentRound),
        estimatedGas: estimatedGas.toString(),
        chainId: chain.id,
        explorerUrl: `https://sepolia.shapescan.xyz/address/${contractAddress}`,
      },
      gameStatus: {
        currentRound: Number(currentRound),
        turnStatus: Number(turnStatus),
        agentHealth: Number(agentHealth),
        accumulatedCharge: Number(accumulatedCharge),
        gameState: Number(state),
        stakeAmount: Number(stakeAmount) / 1e18,
      },
      otomDetails: {
        stakedOtomIds: stakedOtomIds.map(id => id.toString()),
        otomMasses: otomMasses.map(mass => Number(mass)),
        usedOtomIndices: Array.from(usedOtomIndicesSet),
        availableOtomIndices: [0, 1, 2].filter(index => !usedOtomIndicesSet.has(index)),
      },
      instructions: {
        nextSteps: [
          'Send this transaction to make your move',
          'After your move, the agent will reveal their move',
          'Round outcome will be calculated automatically',
        ],
      },
    };

    console.log('✅ Transaction prepared successfully');
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };

  } catch (error) {
    console.error('❌ Prepare player move error:', error);
    
    // Provide more specific error information
    let errorMessage = 'Unknown error occurred';
    let instructions = 'Check game status and ensure it\'s your turn to play';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Provide specific instructions based on error type
      if (errorMessage.includes('execution reverted')) {
        instructions = 'Game may not exist or contract call failed. Check if the game ID is correct.';
      } else if (errorMessage.includes('network')) {
        instructions = 'Network connection issue. Check RPC URL and network status.';
      } else if (errorMessage.includes('contract')) {
        instructions = 'Contract interaction failed. Check contract address and ABI.';
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: `Error preparing player move: ${errorMessage}`,
            playerAddress: input.playerAddress,
            action: input.action,
            otomIndex: input.otomIndex,
            instructions: instructions,
            debug: {
              chainId: config.chainId,
              isMainnet: config.isMainnet,
              contractAddress: addresses.otomDuel[config.isMainnet ? shape.id : shapeSepolia.id],
            },
          }),
        },
      ],
    };
  }
} 