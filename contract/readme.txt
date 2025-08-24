npx hardhat run scripts/deploy_groupchat.js --network baseSepolia
npx hardhat run scripts/deploy.js --network baseSepolia

npx hardhat compile

npx hardhat verify --network baseSepolia <LANGUAGE_LEARNING_GOAL_ADDRESS> <MOCK_REWARD_POOL_ADDRESS>