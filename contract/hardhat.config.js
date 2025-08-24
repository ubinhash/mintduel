require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: [PRIVATE_KEY],
      chainId: 84532,
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia.basescan.org",
          apiKey: BASESCAN_API_KEY
        }
      }
    },
    base: {
      url: process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org",
      accounts: [PRIVATE_KEY],
      chainId: 8453,
      verify: {
        etherscan: {
          apiUrl: "https://api.basescan.org",
          apiKey: BASESCAN_API_KEY
        }
      }
    },
    shapeMainnet: {
      url: process.env.SHAPE_MAINNET_RPC_URL || "",
      accounts: [PRIVATE_KEY],
      chainId: 360,
      verify: {
        etherscan: {
          apiUrl: "https://shapescan.xyz/api",
          browserURL: "https://shapescan.xyz"
        }
      }
    },
    shapeSepolia: {
      url: process.env.SHAPE_SEPOLIA_RPC_URL || "https://sepolia.shape.network",
      accounts: [PRIVATE_KEY],
      chainId: 11011,
      verify: {
        etherscan: {
          apiUrl: "https://explorer-sepolia.shape.network/api",
          browserURL: "https://explorer-sepolia.shape.network"
        }
      }
    }
  },
  etherscan: {
    apiKey: {
      baseSepolia: BASESCAN_API_KEY,
      base: BASESCAN_API_KEY,
      shapeMainnet: 'empty',
      shapeSepolia: 'empty',
    },
    customChains: [
      {
        network: "shapeMainnet",
        chainId: 360,
        urls: {
          apiURL: "https://shapescan.xyz/api",
          browserURL: "https://shapescan.xyz"
        }
      },
      {
        network: "shapeSepolia",
        chainId: 11011,
        urls: {
          apiURL: "https://sepolia.shapescan.xyz/api",
          browserURL: "https://sepolia.shapescan.xyz"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
