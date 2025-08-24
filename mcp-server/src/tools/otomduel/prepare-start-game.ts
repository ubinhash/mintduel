import { z } from 'zod';
import { type InferSchema } from 'xmcp';
import { encodeFunctionData } from 'viem';
import { Address, zeroAddress } from 'viem';
import type { ToolErrorOutput, PrepareStartGameOutput } from '../../types';
import { addresses } from '../../addresses';
import { abi } from '../../abi/otomduel';
import { name2id } from '../otom/convert-otom-names';

export const schema = {
  playerAddress: z
    .string()
    .describe('The address of the player starting the game'),
  otomNames: z
    .array(z.string())
    .length(3)
    .describe('Array of 3 OTOM names to use in the game (e.g., ["Xy78", "Pm-18", "U-92"])'),
};

export const metadata = {
  name: 'prepareStartGame',
  description: 'Prepare a transaction to start an OtomDuel game with 3 OTOMs',
  inputSchema: schema,
  annotations: {
    title: 'Prepare Start Game Transaction',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: true,
    category: 'otom',
    educationalHint: true,
  },
};

export default async function prepareStartGame(params: InferSchema<typeof schema>) {
  try {
    const { playerAddress, otomNames } = params;

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

    // Convert OTOM names to IDs
    const otomIds: bigint[] = [];
    const validOtomNames: string[] = [];

    for (const otomName of otomNames) {
      const normalizedName = otomName.replace(/-/g, '').toLowerCase();
      const tokenId = Object.entries(name2id).find(([key]) => 
        key.toLowerCase() === normalizedName
      )?.[1];

      if (!tokenId) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'INVALID_OTOM_NAME',
                message: `OTOM name "${otomName}" not found. Only isotopes in Universe Alpha are supported (excludes Bohr).`,
                invalidName: otomName,
              }),
            },
          ],
        };
      }

      otomIds.push(BigInt(tokenId));
      validOtomNames.push(otomName);
    }

    // Get contract address for Shape Sepolia (chainId 11011)
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

    // Prepare transaction data
    const stakeAmount = '0.0001'; // 0.0001 ETH
    const stakeAmountWei = '100000000000000'; // 0.0001 ETH in wei

    const transactionData = {
      to: contractAddress,
      data: encodeFunctionData({
        abi,
        functionName: 'startGame',
        args: [otomIds],
      }),
      value: '100000000000000', // 0.0001 ETH stake in wei (100000000000000)
    };

    const result: PrepareStartGameOutput = {
      success: true,
      transaction: transactionData,
      metadata: {
        contractAddress,
        functionName: 'startGame',
        playerAddress: playerAddress as Address,
        otomIds: otomIds.map(id => id.toString()),
        otomNames: validOtomNames,
        stakeAmount,
        estimatedGas: '300000', // Estimated gas for startGame
        chainId,
        explorerUrl: `https://sepolia.shapescan.xyz/address/${contractAddress}`,
      },
      instructions: {
        nextSteps: [
          'Use your wallet to execute this transaction',
          'You will stake 0.0001 ETH to start the game',
          'The 3 OTOMs will be transferred to the contract',
          'After the game starts, the agent will commit their first move',
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
      message: `Error preparing start game transaction: ${
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