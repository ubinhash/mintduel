import { z } from 'zod';
import { type InferSchema } from 'xmcp';
import { Address, isAddress } from 'viem';
import { NftFilters, NftOrdering, OwnedNftsResponse } from 'alchemy-sdk';
import { alchemy } from '../../clients';
import { config } from '../../config';
import type { ToolErrorOutput } from '../../types';
import { getCached, setCached } from '../../utils/cache';
import { name2id } from './convert-otom-names';

// Otom contract addresses
const OTOM_CONTRACT_ADDRESSES = {
  mainnet: '0x2f9810789aebBB6cdC6c0332948fF3B6D11121E3' as Address,
  testnet: '0xc709F59f1356230025d4fdFDCeD92341A14FF2F8' as Address,
};

export const schema = {
  address: z
    .string()
    .refine((address) => isAddress(address), {
      message: 'Invalid address',
    })
    .describe('The wallet address to get Otom NFTs for'),
};

export const metadata = {
  name: 'getOtom',
  description: 'Get Otom NFT ownership data for a given address, filtered by Otom contract addresses.',
  annotations: {
    title: 'Get Otom NFTs',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    requiresWallet: false,
    category: 'otom',
    educationalHint: true,
    chainableWith: ['getShapeNft', 'getCollectionAnalytics'],
    cacheTTL: 60 * 10, // 10 minutes
  },
};

export default async function getOtom({ address }: InferSchema<typeof schema>) {
  const cacheKey = `mcp:otom:${config.chainId}:${address.toLowerCase()}`;
  const cached = await getCached(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  try {
    // Get the appropriate contract address based on chain
    const otomContractAddress = config.isMainnet 
      ? OTOM_CONTRACT_ADDRESSES.mainnet 
      : OTOM_CONTRACT_ADDRESSES.testnet;

    const allOtomNfts: any[] = [];
    let pageKey: string | undefined;
    let totalCount = 0;

    // Iterate through all pages to get all Otom NFTs
    do {
      const nftsResponse: OwnedNftsResponse = await alchemy.nft.getNftsForOwner(address, {
        pageSize: 100, // Increased page size for efficiency
        omitMetadata: false,
        orderBy: NftOrdering.TRANSFERTIME,
        contractAddresses: [otomContractAddress], // Filter by Otom contract address
        pageKey: pageKey,
      });

      // Filter NFTs to only include those from the Otom contract
      const otomNfts = nftsResponse.ownedNfts.filter(
        (nft) => nft.contract.address.toLowerCase() === otomContractAddress.toLowerCase()
      );

      allOtomNfts.push(...otomNfts);
      totalCount = nftsResponse.totalCount || 0;
      pageKey = nftsResponse.pageKey;

      // Safety check to prevent infinite loops
      if (allOtomNfts.length > 1000) {
        console.warn(`Stopping pagination after 1000 NFTs for address ${address}`);
        break;
      }
    } while (pageKey);

    // Analyze metadata attributes
    let universeAlphaCount = 0;
    let isotopeInUniverseAlphaCount = 0;
    const combinedNames: string[] = [];
    console.log(allOtomNfts);

        for (const nft of allOtomNfts) {
      let isInUniverseAlpha = false;
      let hasProtons = false;

      // Convert to string for comparison
      const nftTokenIdString = String(nft.tokenId);
      const name2idValues = Object.values(name2id).map(v => String(v));
      const tokenIdInRecord = name2idValues.includes(nftTokenIdString);
      console.log(tokenIdInRecord);
      console.log(nftTokenIdString);

      // Check for Universe Alpha
      if (nft.raw?.metadata?.attributes) {
        const attributes = nft.raw.metadata.attributes as any[];
        
        // Check Universe Alpha from metadata OR token ID record
        const universeAttr = attributes.find(attr => attr.trait_type === 'Universe');
        isInUniverseAlpha = (universeAttr && universeAttr.value === 'Alpha') || tokenIdInRecord;
        
        // Check for Protons attribute OR token ID record
        const protonsAttr = attributes.find(attr => attr.trait_type === 'Protons');
        hasProtons = !!protonsAttr || tokenIdInRecord;

        // Create combined name from Name and Mass (only if in Universe Alpha and has protons)
        if (isInUniverseAlpha && hasProtons) {
          const nameAttr = attributes.find(attr => attr.trait_type === 'Name');
          const massAttr = attributes.find(attr => attr.trait_type === 'Mass');
          
          if (nameAttr && massAttr) {
            const combinedName = `${nameAttr.value}-${massAttr.value}`;
            combinedNames.push(combinedName);
          } else if (nameAttr) {
            // If only Name exists, use just the name
            combinedNames.push(nameAttr.value);
          } else {
            // Fallback to token ID if no name
            combinedNames.push(`Token-${nft.tokenId}`);
          }
        }
      } else {
        // If no metadata, use token ID record validation
        isInUniverseAlpha = tokenIdInRecord;
        hasProtons = tokenIdInRecord;
        
        // Fallback to token ID if no metadata (only if in Universe Alpha and has protons)
        if (isInUniverseAlpha && hasProtons) {
          combinedNames.push(`Token-${nft.tokenId}`);
        }
      }

      // Count based on validation results
      if (isInUniverseAlpha) {
        universeAlphaCount++;
      }
      
      if (hasProtons && isInUniverseAlpha) {
        isotopeInUniverseAlphaCount++;
      }
    }

    const result = {
      ownerAddress: address,
      timestamp: new Date().toISOString(),
      chainId: config.chainId,
      network: config.isMainnet ? 'shape-mainnet' : 'shape-sepolia',
      otomContractAddress: otomContractAddress,
      summary: {
        totalOtomNfts: allOtomNfts.length,
        pagesFetched: Math.ceil(allOtomNfts.length / 100),
        universeAlphaCount: universeAlphaCount,
        isotopeInUniverseAlphaCount: isotopeInUniverseAlphaCount,
      },
      combinedNames: combinedNames.sort((a, b) => {
        // Extract mass values from combined names (e.g., "Pm-18" -> 18)
        const massA = parseInt(a.split('-')[1]) || 0;
        const massB = parseInt(b.split('-')[1]) || 0;
        return massA - massB; // Sort by mass in ascending order
      }),
      combinedNamesFormat: "Name-Mass (e.g., 'Pm-18' where 18 is the mass value)",
    };

    const response = {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };

    await setCached(cacheKey, JSON.stringify(response), metadata.annotations.cacheTTL);

    return response;
  } catch (error) {
    const errorOutput: ToolErrorOutput = {
      error: true,
      message: `Error fetching Otom NFTs: ${
        error instanceof Error ? error.message : 'Unknown error occurred'
      }`,
      ownerAddress: address,
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