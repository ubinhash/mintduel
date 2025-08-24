// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SampleNFT is ERC721, Ownable {
    // Replace Counters with manual increment
    uint256 private _tokenIds = 0;

    // Base URI for token metadata
    string private _baseTokenURI;

    // Operator management
    mapping(address => bool) public operators;
    
    // Events
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event NFTMinted(address indexed to, uint256 indexed tokenId);
    event BaseURIUpdated(string indexed oldURI, string indexed newURI);

    // Modifiers
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Caller is not an operator");
        _;
    }

    constructor() ERC721("Sample NFT", "SAMPLE") Ownable(msg.sender) {
        _baseTokenURI = "https://your-metadata-api.com/metadata/";
    }

    /**
     * @dev Add an operator who can mint NFTs
     * @param operator Address to add as operator
     */
    function addOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator address");
        require(!operators[operator], "Operator already exists");
        
        operators[operator] = true;
        emit OperatorAdded(operator);
    }

    /**
     * @dev Remove an operator
     * @param operator Address to remove as operator
     */
    function removeOperator(address operator) external onlyOwner {
        require(operators[operator], "Operator does not exist");
        
        operators[operator] = false;
        emit OperatorRemoved(operator);
    }

    /**
     * @dev Mint a new NFT (only operators or owner can call)
     * @param to Address to mint the NFT to
     * @return tokenId The ID of the newly minted NFT
     */
    function mint(address to) 
        external 
        onlyOperator 
        returns (uint256 tokenId) 
    {
        require(to != address(0), "Cannot mint to zero address");

        _tokenIds++;
        tokenId = _tokenIds;

        _safeMint(to, tokenId);

        emit NFTMinted(to, tokenId);
        return tokenId;
    }

    /**
     * @dev Batch mint multiple NFTs
     * @param to Address to mint the NFTs to
     * @param count Number of NFTs to mint
     * @return tokenIds Array of the newly minted NFT IDs
     */
    function batchMint(address to, uint256 count) 
        external 
        onlyOperator 
        returns (uint256[] memory tokenIds) 
    {
        require(to != address(0), "Cannot mint to zero address");
        require(count > 0, "Count must be greater than 0");

        tokenIds = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            _tokenIds++;
            tokenIds[i] = _tokenIds;

            _safeMint(to, tokenIds[i]);

            emit NFTMinted(to, tokenIds[i]);
        }

        return tokenIds;
    }

    /**
     * @dev Check if an address is an operator
     * @param operator Address to check
     * @return bool True if the address is an operator
     */
    function isOperator(address operator) external view returns (bool) {
        return operators[operator] || operator == owner();
    }

    /**
     * @dev Get the current token ID counter
     * @return uint256 Current token ID
     */
    function getCurrentTokenId() external view returns (uint256) {
        return _tokenIds;
    }

    /**
     * @dev Get total supply of minted NFTs
     * @return uint256 Total number of NFTs minted
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIds;
    }

    /**
     * @dev Set the base URI for token metadata (only owner can call)
     * @param newBaseURI New base URI for token metadata
     */
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        string memory oldURI = _baseTokenURI;
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(oldURI, newBaseURI);
    }

    /**
     * @dev Get the current base URI
     * @return string Current base URI
     */
    function getBaseURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev Override _baseURI to return the stored base URI
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
} 