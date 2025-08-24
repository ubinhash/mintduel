import { z } from 'zod';
import { type InferSchema } from 'xmcp';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { shape, shapeSepolia } from 'viem/chains';
import { config } from '../../config';
import { addresses } from '../../addresses';

// OtomDuel contract ABI for claim refund function
const otomDuelAbi = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256"
      }
    ],
    name: "claimRefund",
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
  playerAddress: z.string().describe('The address of the player claiming the refund'),
};

export const metadata = {
  name: 'prepareClaimRefund',
  description: 'Prepare a transaction to claim refund for a completed OtomDuel game. Game ID is automatically inferred from the player address.',
  inputSchema: schema,
  annotations: {
    title: 'Prepare Claim Refund',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: true,
    category: 'otomduel',
    educationalHint: true,
  },
};

export default async function prepareClaimRefund(input: InferSchema<typeof schema>) {
  try {
    const { playerAddress } = input;

    console.log('=== Prepare Claim Refund Debug ===');
    console.log('Input:', { playerAddress });

    // Create public client
    const chain = config.isMainnet ? shape : shapeSepolia;
    const contractAddress = addresses.otomDuel[chain.id];

    console.log('Chain:', chain.id, chain.name);
    console.log('Contract Address:', contractAddress);

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
              instructions: 'Player needs to have an active game to claim refund',
            }),
          },
        ],
      };
    }

    console.log(`Prepare Claim Refund - Game ${gameId.toString()}, Player: ${playerAddress}`);

    // Check game status and completion
    console.log('Calling whoseTurn...');
    const [round, turnStatus] = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: otomDuelAbi,
      functionName: 'whoseTurn',
      args: [BigInt(gameId)],
    });

    console.log(`Game Status - Round: ${round}, Turn Status: ${turnStatus}`);

    // Check if game is completed (round should be 4 or 5)
    if (round !== BigInt(4) && round !== BigInt(5)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'Game is not completed yet',
              currentRound: Number(round),
              turnStatus: Number(turnStatus),
              instructions: 'Game must be completed (round 4) before claiming refund',
            }),
          },
        ],
      };
    }

    // Get game details to validate player and check refund status
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
      agentHealth: Number(agentHealth),
      currentRound: Number(currentRound),
      state: Number(state),
      stakeAmount: Number(stakeAmount) / 1e18,
      refundAmount: Number(refundAmount) / 1e18,
      refundClaimed
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

    // Check if refund has already been claimed
    if (refundClaimed) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'Refund has already been claimed for this game',
              gameId: gameId,
              refundAmount: Number(refundAmount) / 1e18,
              instructions: 'Refund can only be claimed once per game',
            }),
          },
        ],
      };
    }

    // Check if there's actually a refund to claim
    if (refundAmount === BigInt(0)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: 'No refund available to claim',
              gameId: gameId.toString(),
              agentHealth: Number(agentHealth),
              stakeAmount: Number(stakeAmount) / 1e18,
              instructions: 'Refund amount is 0 - no discount earned',
            }),
          },
        ],
      };
    }

    // Prepare transaction data
    const transactionData = encodeFunctionData({
      abi: otomDuelAbi,
      functionName: 'claimRefund',
      args: [BigInt(gameId)],
    });

    console.log('Transaction prepared:', {
      gameId: gameId.toString(),
      refundAmount: Number(refundAmount) / 1e18,
      transactionData: transactionData
    });

    // Estimate gas
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
      estimatedGas = '100000'; // Default estimate
    }

    const result = {
      success: true,
      message: 'Claim refund transaction prepared successfully',
      transaction: {
        to: contractAddress,
        data: transactionData,
        value: '0x0', // No ETH value needed for claim refund
      },
      metadata: {
        contractAddress: contractAddress,
        functionName: 'claimRefund',
        playerAddress: playerAddress,
        gameId: gameId.toString(),
        refundAmount: Number(refundAmount) / 1e18,
        stakeAmount: Number(stakeAmount) / 1e18,
        agentHealth: Number(agentHealth),
        estimatedGas: estimatedGas,
        chainId: chain.id,
        explorerUrl: `https://sepolia.shapescan.xyz/address/${contractAddress}`,
      },
      gameStatus: {
        currentRound: Number(currentRound),
        turnStatus: Number(turnStatus),
        agentHealth: Number(agentHealth),
        gameState: Number(state),
        stakeAmount: Number(stakeAmount) / 1e18,
        refundAmount: Number(refundAmount) / 1e18,
        refundClaimed: refundClaimed,
      },
      instructions: {
        nextSteps: [
          'Send this transaction to claim your refund',
          'The refund will be sent to your wallet address',
          'Check the transaction on Shape Sepolia explorer',
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
    console.error('❌ Prepare claim refund error:', error);
    
    // Provide more specific error information
    let errorMessage = 'Unknown error occurred';
    let instructions = 'Check game status and ensure the game is completed';
    
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
            message: `Error preparing claim refund: ${errorMessage}`,
            playerAddress: input.playerAddress,
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