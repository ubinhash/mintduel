// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IOtomsDatabase.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// Interface for SampleNFT contract
interface ISampleNFT {
    function mint(address to) external returns (uint256 tokenId);
    function isOperator(address operator) external view returns (bool);
}

contract OtomDuel is ReentrancyGuard, Ownable, IERC1155Receiver {

    IOtomsDatabase public otomDatabase;
    IERC1155 public otomToken;
    ISampleNFT public sampleNFT;

    // Game constants
    uint256 public constant STARTING_HEALTH = 100;
    uint256 public constant MAX_HEALTH = 100;
    uint256 public constant ROUNDS_PER_GAME = 3;
    uint256 public constant RECOVER_HEALTH_GAIN = 10;
    uint256 public constant MINT_PRICE = 0.0001 ether;

    // Game states
    enum GameState { WAITING, ACTIVE, COMPLETED, CANCELLED }
    enum PlayerAction { NONE, ATTACK, CHARGE }
    enum AgentAction { NONE, DEFEND, FLIP_CHARGE, RECOVER }

    // Game session structure
    struct GameSession {
        address player;
        uint256[] stakedOtomIds;
        uint256[] otomMasses;
        uint256 agentHealth;
        uint256 currentRound;
        uint256 accumulatedCharge;
        GameState state;
        uint256 stakeAmount;
        uint256 refundAmount;
        bool refundClaimed;
        mapping(uint256 => PlayerAction) playerActions;
        mapping(uint256 => bytes32) agentCommits; // Commit hash for each round
        mapping(uint256 => AgentAction) agentActions; // Revealed actions
        mapping(uint256 => bool) otomUsed;
        mapping(uint256 => bool) roundCompleted; // Track if round is completed
        mapping(uint256 => uint256) otomIndices; // Track which OTOM index was used in each round
    }

    // Agent management
    mapping(address => bool) public whitelistedAgents;
    
    // Events
    event GameStarted(address indexed player, uint256 gameId, uint256[] otomIds, uint256[] masses);
    event AgentCommitted(uint256 indexed gameId, uint256 round, bytes32 commitHash);
    event PlayerPlayed(uint256 indexed gameId, uint256 round, PlayerAction action, uint256 otomIndex);
    event AgentRevealed(uint256 indexed gameId, uint256 round, AgentAction action, bytes32 secret);
    event RoundCompleted(uint256 indexed gameId, uint256 round, uint256 agentHealth);
    event GameCompleted(uint256 indexed gameId, uint256 finalAgentHealth, uint256 refundAmount);
    event RefundClaimed(uint256 indexed gameId, address indexed player, uint256 amount);
    event AgentWhitelisted(address indexed agent, bool whitelisted);
    event NFTMinted(uint256 indexed gameId, address indexed player, uint256 tokenId);

    // State variables
    uint256 private _gameIds = 1;
    mapping(uint256 => GameSession) public games;
    mapping(address => uint256) public playerActiveGame;

    // Add the constant for Alpha Universe Hash
    bytes32 public constant ALPHA_UNIVERSE_HASH = 0xfda008503288e5abc370328150d20993fec26efe5707f2d12ab552ebb0da5e26;

    // Modifiers
    modifier gameExists(uint256 gameId) {
        require(games[gameId].player != address(0), "Game does not exist");
        _;
    }

    modifier onlyPlayer(uint256 gameId) {
        require(games[gameId].player == msg.sender, "Only game player can call this");
        _;
    }

    modifier onlyWhitelistedAgent() {
        require(whitelistedAgents[msg.sender], "Only whitelisted agents can call this");
        _;
    }

    modifier gameActive(uint256 gameId) {
        require(games[gameId].state == GameState.ACTIVE, "Game is not active");
        _;
    }

    modifier gameCompleted(uint256 gameId) {
        require(games[gameId].state == GameState.COMPLETED, "Game is not completed");
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Whitelist or remove an agent
     */
    function setAgentWhitelist(address agent, bool whitelisted) external onlyOwner {
        whitelistedAgents[agent] = whitelisted;
        emit AgentWhitelisted(agent, whitelisted);
    }

    /**
     * @dev Set the OTOM database address (owner only)
     * @param _otomDatabase Address of the OTOM database contract
     */
    function setOtomDatabase(address _otomDatabase) external onlyOwner {
        require(_otomDatabase != address(0), "Invalid database address");
        otomDatabase = IOtomsDatabase(_otomDatabase);
    }

    /**
     * @dev Set the OTOM token address (owner only)
     * @param _otomToken Address of the OTOM ERC1155 token contract
     */
    function setOtomToken(address _otomToken) external onlyOwner {
        require(_otomToken != address(0), "Invalid token address");
        otomToken = IERC1155(_otomToken);
    }

    /**
     * @dev Set the Sample NFT address (owner only)
     * @param _sampleNFT Address of the Sample NFT ERC721 contract
     */
    function setSampleNFT(address _sampleNFT) external onlyOwner {
        require(_sampleNFT != address(0), "Invalid NFT address");
        sampleNFT = ISampleNFT(_sampleNFT);
    }

    /**
     * @dev Start a new game by staking OTOMs and paying the mint price
     * @param otomIds Array of OTOM token IDs to stake
     */
    function startGame(uint256[] calldata otomIds) 
        external 
        payable 
        nonReentrant 
    {
        require(msg.value == MINT_PRICE, "Incorrect stake amount");
        require(otomIds.length == ROUNDS_PER_GAME, "Must stake exactly 3 OTOMs");
        require(playerActiveGame[msg.sender] == 0, "Player already has active game");

        uint256[] memory masses = new uint256[](ROUNDS_PER_GAME);
        uint256 totalMass = 0;

        // Transfer OTOMs and get masses from database
        for (uint256 i = 0; i < otomIds.length; i++) {
            // Transfer OTOM to contract
            otomToken.safeTransferFrom(msg.sender, address(this), otomIds[i], 1, "");
            
            // Get molecule from database
            Molecule memory molecule = otomDatabase.getMoleculeByTokenId(otomIds[i]);
            
            // Check if it's in Alpha Universe
            require(molecule.universeHash == ALPHA_UNIVERSE_HASH, "OTOM must be in Alpha Universe");
            
            // Check if it's a singleton
            require(compareStrings(molecule.bond.bondType, "singleton"), "OTOM must be a singleton");
            
            // Get mass from first giving atom
            require(molecule.givingAtoms.length > 0, "Molecule must have giving atoms");
            uint256 mass = molecule.givingAtoms[0].mass / 1e18;
            
            masses[i] = mass;
            totalMass += mass;
        }

        require(totalMass <= 100, "Total atomic mass must be less than or equal to 100");

        uint256 gameId = _gameIds++;

        GameSession storage game = games[gameId];
        game.player = msg.sender;
        game.stakedOtomIds = otomIds;
        game.otomMasses = masses;
        game.agentHealth = STARTING_HEALTH;
        game.currentRound = 0;
        game.accumulatedCharge = 0;
        game.state = GameState.ACTIVE;
        game.stakeAmount = msg.value;
        game.refundAmount = 0;
        game.refundClaimed = false;

        playerActiveGame[msg.sender] = gameId;

        emit GameStarted(msg.sender, gameId, otomIds, masses);
    }

    /**
     * @dev Agent commits their move for the current round
     * @param gameId The game ID
     * @param commitHash Hash of (action + secret + round)
     */
    function agentPlay(uint256 gameId, bytes32 commitHash) 
        external 
        gameExists(gameId) 
        gameActive(gameId) 
        onlyWhitelistedAgent 
        nonReentrant 
    {
        GameSession storage game = games[gameId];
        
        require(game.currentRound < ROUNDS_PER_GAME, "Game already completed");
        require(game.agentCommits[game.currentRound] == bytes32(0), "Agent already committed for this round");

        game.agentCommits[game.currentRound] = commitHash;

        emit AgentCommitted(gameId, game.currentRound, commitHash);
    }

    /**
     * @dev Player plays their move for the current round
     * @param gameId The game ID
     * @param action Player's action (ATTACK or CHARGE)
     * @param otomIndex Index of the OTOM to use (0-2)
     */
    function playerPlay(uint256 gameId, PlayerAction action, uint256 otomIndex) 
        external 
        gameExists(gameId) 
        onlyPlayer(gameId) 
        gameActive(gameId) 
        nonReentrant 
    {
        GameSession storage game = games[gameId];
        
        require(game.currentRound < ROUNDS_PER_GAME, "Game already completed");
        require(game.agentCommits[game.currentRound] != bytes32(0), "Agent must commit first");
        require(game.playerActions[game.currentRound] == PlayerAction.NONE, "Player already played this round");
        require(action != PlayerAction.NONE, "Invalid action - cannot play NONE");
        require(otomIndex < ROUNDS_PER_GAME, "Invalid OTOM index");
        require(!game.otomUsed[otomIndex], "OTOM already used");

        // Mark OTOM as used and store the index
        game.otomUsed[otomIndex] = true;
        game.playerActions[game.currentRound] = action;
        game.otomIndices[game.currentRound] = otomIndex;

        emit PlayerPlayed(gameId, game.currentRound, action, otomIndex);
    }

    /**
     * @dev Agent reveals their move for the current round
     * @param gameId The game ID
     * @param action The agent's action
     * @param secret The secret used in the commit
     */
    function reveal(uint256 gameId, AgentAction action, bytes32 secret) 
        external 
        gameExists(gameId) 
        gameActive(gameId) 
        onlyWhitelistedAgent 
        nonReentrant 
    {
        GameSession storage game = games[gameId];
        
        require(game.currentRound < ROUNDS_PER_GAME, "Game already completed");
        require(game.agentCommits[game.currentRound] != bytes32(0), "Agent must commit first");
        require(game.playerActions[game.currentRound] != PlayerAction.NONE, "Player must play first");
        require(action != AgentAction.NONE, "Invalid action - cannot reveal NONE");
        require(game.agentActions[game.currentRound] == AgentAction.NONE, "Agent already revealed for this round");

        // Verify the commit
        bytes32 expectedCommit = keccak256(abi.encodePacked(action, secret, game.currentRound));
        require(game.agentCommits[game.currentRound] == expectedCommit, "Invalid commit");

        game.agentActions[game.currentRound] = action;

        // Calculate round outcome
        // Get the OTOM index used in this round and get its mass
        uint256 otomIndexUsed = game.otomIndices[game.currentRound];
        uint256 otomMassUsed = game.otomMasses[otomIndexUsed];
        _calculateRoundOutcome(game, game.playerActions[game.currentRound], action, otomMassUsed);
        
        game.roundCompleted[game.currentRound] = true;
        game.currentRound++;

        emit AgentRevealed(gameId, game.currentRound - 1, action, secret);
        emit RoundCompleted(gameId, game.currentRound - 1, game.agentHealth);

        // Check if game is complete
        if (game.currentRound == ROUNDS_PER_GAME) {
            _completeGame(gameId);
        }
    }

    /**
     * @dev Helper function to check if a reveal is valid for a given game and round
     * @param gameId The game ID
     * @param round The round number
     * @param action The agent action to check
     * @param secret The secret used for the commit
     * @return bool True if the reveal is valid
     */
    function validReveal(uint256 gameId, uint256 round, AgentAction action, bytes32 secret) external view gameExists(gameId) returns (bool) {
        GameSession storage game = games[gameId];
        
        // Check if the round exists and has a commit
        if (round >= game.currentRound || game.agentCommits[round] == bytes32(0)) {
            return false;
        }
        
        // Check if action is valid
        if (action == AgentAction.NONE) {
            return false;
        }
        
        // Verify the commit matches
        bytes32 expectedCommit = keccak256(abi.encodePacked(action, secret, round));
        return game.agentCommits[round] == expectedCommit;
    }

    /**
     * @dev Get the commit hash for a specific round
     * @param gameId The game ID
     * @param round The round number
     * @return bytes32 The commit hash for the round, or bytes32(0) if no commit exists
     */
    function getCommitHash(uint256 gameId, uint256 round) external view gameExists(gameId) returns (bytes32) {
        GameSession storage game = games[gameId];
        return game.agentCommits[round];
    }

    /**
     * @dev Calculate round outcome based on player and agent actions
     */
    function _calculateRoundOutcome(
        GameSession storage game, 
        PlayerAction playerAction, 
        AgentAction agentAction, 
        uint256 otomMass
    ) internal {
        if (playerAction == PlayerAction.ATTACK) {
            uint256 attackPower = otomMass + game.accumulatedCharge;
            game.accumulatedCharge = 0; // Reset charge after attack

            if (agentAction == AgentAction.DEFEND) {
                // No effect on agent health
            } else if (agentAction == AgentAction.FLIP_CHARGE) {
                game.agentHealth = _subtractHealth(game.agentHealth, attackPower);
            } else if (agentAction == AgentAction.RECOVER) {
                game.agentHealth = _addHealth(game.agentHealth, RECOVER_HEALTH_GAIN);
                game.agentHealth = _subtractHealth(game.agentHealth, attackPower);
            }
        } else if (playerAction == PlayerAction.CHARGE) {
            game.accumulatedCharge += otomMass;

            if (agentAction == AgentAction.DEFEND) {
                // Agent loses half of the charge value
                uint256 damageToAgent = otomMass / 2;
                game.agentHealth = _subtractHealth(game.agentHealth, damageToAgent);
            } else if (agentAction == AgentAction.FLIP_CHARGE) {
                // Reduce accumulated charge by otomMass (minimum 0)
                if (game.accumulatedCharge >= otomMass) {
                    game.accumulatedCharge -= otomMass;
                } else {
                    game.accumulatedCharge = 0;
                }
            } else if (agentAction == AgentAction.RECOVER) {
                game.agentHealth = _addHealth(game.agentHealth, RECOVER_HEALTH_GAIN);
                // Agent also gains the player's charge
                game.agentHealth = _addHealth(game.agentHealth, game.accumulatedCharge);
            }
        }
    }

    /**
     * @dev Complete the game and calculate refund
     */
    function _completeGame(uint256 gameId) internal {
        GameSession storage game = games[gameId];
        game.state = GameState.COMPLETED;

        // Calculate refund based on agent's final health
        // Higher agent health = better player performance = more refund
        uint256 healthPercentage = (game.agentHealth * 100) / MAX_HEALTH;
        uint256 discountPercentage = 100 - healthPercentage;
        game.refundAmount = (game.stakeAmount * discountPercentage) / 100;

        emit GameCompleted(gameId, game.agentHealth, game.refundAmount);
    }

    /**
     * @dev Add health with max cap
     */
    function _addHealth(uint256 currentHealth, uint256 amount) internal pure returns (uint256) {
        uint256 newHealth = currentHealth + amount;
        return newHealth > MAX_HEALTH ? MAX_HEALTH : newHealth;
    }

    /**
     * @dev Subtract health with minimum 0
     */
    function _subtractHealth(uint256 currentHealth, uint256 amount) internal pure returns (uint256) {
        return currentHealth > amount ? currentHealth - amount : 0;
    }

    /**
     * @dev Get game details
     */
    function getGame(uint256 gameId) external view gameExists(gameId) returns (
        address player,
        uint256[] memory stakedOtomIds,
        uint256[] memory otomMasses,
        uint256 agentHealth,
        uint256 currentRound,
        uint256 accumulatedCharge,
        GameState state,
        uint256 stakeAmount,
        uint256 refundAmount,
        bool refundClaimed
    ) {
        GameSession storage game = games[gameId];
        return (
            game.player,
            game.stakedOtomIds,
            game.otomMasses,
            game.agentHealth,
            game.currentRound,
            game.accumulatedCharge,
            game.state,
            game.stakeAmount,
            game.refundAmount,
            game.refundClaimed
        );
    }

    /**
     * @dev Get player's active game ID
     */
    function getPlayerActiveGame(address player) external view returns (uint256) {
        return playerActiveGame[player];
    }

    /**
     * @dev Claim refund for a completed game
     * @param gameId The game ID
     */
    function claimRefund(uint256 gameId) external gameExists(gameId) onlyPlayer(gameId) nonReentrant {
        GameSession storage game = games[gameId];
        
        require(game.state == GameState.COMPLETED, "Game is not completed");
        require(!game.refundClaimed, "Refund already claimed");
        require(game.refundAmount > 0, "No refund available");
        
        // Mark refund as claimed
        game.refundClaimed = true;
        
        // Mint NFT to player if SampleNFT contract is set
        uint256 tokenId = 0;
        uint256 finalRefundAmount = game.refundAmount;
        
        if (address(sampleNFT) != address(0)) {
            try sampleNFT.mint(game.player) returns (uint256 mintedTokenId) {
                tokenId = mintedTokenId;
                emit NFTMinted(gameId, game.player, tokenId);
            } catch {
                // If minting fails, give full refund as compensation
                finalRefundAmount = game.stakeAmount;
                emit NFTMinted(gameId, game.player, 0);
            }
        }
        
        // Transfer refund to player (either partial or full based on NFT minting success)
        (bool success, ) = game.player.call{value: finalRefundAmount}("");
        require(success, "Refund transfer failed");
        
        // Reset player's active game so they can start a new game
        playerActiveGame[game.player] = 0;
        
        emit RefundClaimed(gameId, game.player, finalRefundAmount);
    }

    /**
     * @dev Simple function to check turn status
     * @param gameId The game ID
     * @return round Current round number (0-2, or 4 if completed, or 5 if refund claimed)
     * @return turnStatus 0=agent needs to commit, 1=player needs to play, 2=agent needs to reveal, 0=game completed, 0=refund claimed
     */
    function whoseTurn(uint256 gameId) external view gameExists(gameId) returns (uint256 round, uint256 turnStatus) {
        GameSession storage game = games[gameId];
        
        // Check if game is completed and refund claimed
        if (game.state == GameState.COMPLETED && game.refundClaimed) {
            return (5, 0); // Round 5, refund claimed
        }
        
        // Check if game is completed but refund not claimed
        if (game.state == GameState.COMPLETED || game.state == GameState.CANCELLED) {
            return (4, 0); // Round 4, completed
        }
        
        round = game.currentRound;
        
        // Check turn status for current round
        if (game.agentCommits[game.currentRound] == bytes32(0)) {
            return (round, 0); // Agent needs to commit
        } else if (game.playerActions[game.currentRound] == PlayerAction(0)) {
            return (round, 1); // Player needs to play
        } else {
            return (round, 2); // Agent needs to reveal
        }
    }

    /**
     * @dev Get previous actions for a game
     * @param gameId The game ID
     * @return playerActions Array of player actions (0=NONE, 1=ATTACK, 2=CHARGE)
     * @return agentActions Array of agent actions (0=NONE, 1=DEFEND, 2=FLIP_CHARGE, 3=RECOVER)
     * @return otomIndices Array of OTOM indices used by player (0-2, 255=not used)
     * @return otomMasses Array of OTOM masses used in each round
     */
    function getGameActions(uint256 gameId) external view gameExists(gameId) returns (
        uint256[] memory playerActions,
        uint256[] memory agentActions,
        uint256[] memory otomIndices,
        uint256[] memory otomMasses
    ) {
        GameSession storage game = games[gameId];
        
        playerActions = new uint256[](ROUNDS_PER_GAME);
        agentActions = new uint256[](ROUNDS_PER_GAME);
        otomIndices = new uint256[](ROUNDS_PER_GAME);
        otomMasses = new uint256[](ROUNDS_PER_GAME);
        
        for (uint256 i = 0; i < ROUNDS_PER_GAME; i++) {
            // Player actions
            if (game.playerActions[i] == PlayerAction.ATTACK) {
                playerActions[i] = 1; // ATTACK
            } else if (game.playerActions[i] == PlayerAction.CHARGE) {
                playerActions[i] = 2; // CHARGE
            } else {
                playerActions[i] = 0; // NONE (not played)
            }
            
            // Agent actions
            if (game.agentActions[i] == AgentAction.DEFEND) {
                agentActions[i] = 1; // DEFEND
            } else if (game.agentActions[i] == AgentAction.FLIP_CHARGE) {
                agentActions[i] = 2; // FLIP_CHARGE
            } else if (game.agentActions[i] == AgentAction.RECOVER) {
                agentActions[i] = 3; // RECOVER
            } else {
                agentActions[i] = 0; // NONE (not revealed)
            }
            
            // OTOM indices - check if player has played to determine if OTOM index is valid
            if (game.playerActions[i] != PlayerAction.NONE) {
                otomIndices[i] = game.otomIndices[i];
            } else {
                otomIndices[i] = 255; // Not used yet
            }
            
            // OTOM masses - always return the mass for index i (0, 1, 2)
            otomMasses[i] = game.otomMasses[i];
        }
    }

    /**
     * @dev Emergency function to withdraw stuck funds (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "Withdrawal failed");
    }

    // IERC1155Receiver functions
    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }

    // Receive function to accept ETH
    receive() external payable {}

    /**
     * @dev Compare two strings
     * @param a First string
     * @param b Second string
     * @return bool True if strings are equal
     */
    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}
