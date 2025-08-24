import { shape } from 'viem/chains';
require('dotenv').config()
// Debug environment variables
console.log('Environment Variables Debug:');
console.log('CHAIN_ID:', process.env.CHAIN_ID);
console.log('REDIS_URL exists:', !!process.env.REDIS_URL);

export const config = {
  chainId: Number(process.env.CHAIN_ID),
  alchemyApiKey: process.env.ALCHEMY_API_KEY as string,
  raribleApiKey: process.env.RARIBLE_API_KEY as string,
  isMainnet: Number(process.env.CHAIN_ID) === shape.id,
  redisUrl: process.env.REDIS_URL as string,
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY as string,
  agentAddress: process.env.AGENT_ADDRESS as string,
  defaultRpcUrl:
    Number(process.env.CHAIN_ID) === shape.id
      ? 'https://mainnet.shape.network'
      : process.env.ALCHEMY_API_KEY 
        ? `https://shape-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : 'https://sepolia.shape.network',
} as const;
