import { z } from 'zod';
import { type InferSchema } from 'xmcp';
import { encodeFunctionData } from 'viem';
import { Address, zeroAddress } from 'viem';
import type { ToolErrorOutput, PrepareApproveOtomOutput } from '../../types';
import { addresses } from '../../addresses';

export const schema = {
  playerAddress: z
    .string()
    .describe('The address of the player who needs to approve OTOM transfers'),
  operatorAddress: z
    .string()
    .describe('The address of the operator (OtomDuel contract) to approve'),
};

export const metadata = {
  name: 'prepareApproveOtom',
  description: 'Prepare a transaction to approve the OtomDuel contract to transfer OTOM tokens',
  inputSchema: schema,
  annotations: {
    title: 'Prepare OTOM Approval Transaction',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: true,
    category: 'otomduel',
    educationalHint: true,
  },
};

export default async function prepareApproveOtom(params: InferSchema<typeof schema>) {
  try {
    const { playerAddress, operatorAddress } = params;

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

    // Validate operator address
    if (!operatorAddress || operatorAddress === zeroAddress) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'INVALID_OPERATOR_ADDRESS',
              message: 'Invalid operator address provided',
            }),
          },
        ],
      };
    }

    // Get OTOM contract address for Shape Sepolia (chainId 11011)
    const chainId = 11011; // Shape Sepolia
    const otomContractAddress = addresses.otom[chainId];

    if (!otomContractAddress || otomContractAddress === zeroAddress) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'OTOM_CONTRACT_NOT_DEPLOYED',
              message: `OTOM contract not available on chain ${chainId}`,
            }),
          },
        ],
      };
    }

    // Prepare transaction data for setApprovalForAll
    const transactionData = {
      to: otomContractAddress,
      data: encodeFunctionData({
        abi: [
          {
            inputs: [
              {
                internalType: "address",
                name: "operator",
                type: "address"
              },
              {
                internalType: "bool",
                name: "approved",
                type: "bool"
              }
            ],
            name: "setApprovalForAll",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function"
          }
        ],
        functionName: 'setApprovalForAll',
        args: [operatorAddress as Address, true], // Approve the operator
      }),
      value: '0x0', // No ETH value needed for approval
    };

    const result: PrepareApproveOtomOutput = {
      success: true,
      transaction: transactionData,
      metadata: {
        otomContractAddress,
        functionName: 'setApprovalForAll',
        playerAddress: playerAddress as Address,
        operatorAddress: operatorAddress as Address,
        approved: true,
        estimatedGas: '50000', // Estimated gas for setApprovalForAll
        chainId,
        explorerUrl: `https://sepolia.shapescan.xyz/address/${otomContractAddress}`,
      },
      instructions: {
        nextSteps: [
          'Use your wallet to execute this approval transaction',
          'This allows the OtomDuel contract to transfer your OTOM tokens',
          'After approval, you can start the game',
          'Check the transaction on Shape Sepolia explorer',
        ],
      },
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
      message: `Error preparing OTOM approval transaction: ${
        error instanceof Error ? error.message : 'Unknown error occurred'
      }`,
      ownerAddress: params.playerAddress as Address,
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