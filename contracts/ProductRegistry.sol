// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProductRegistry
/// @notice Stores tamper-proof records of genuine products. Only the keccak256 hash of each
///         serial number is stored on-chain, so serials cannot be harvested from the chain.
contract ProductRegistry {
    struct Product {
        string name;
        string batch;
        string manufacturer;
        uint64 registeredAt;
        address registeredBy;
        bool exists;
        bool flagged;
    }

    address public owner;
    uint256 public totalProducts;
    mapping(address => bool) public manufacturers;
    mapping(bytes32 => Product) private products;

    event ManufacturerUpdated(address indexed account, bool allowed);
    event ProductRegistered(bytes32 indexed serialHash, string name, string batch, string manufacturer, address indexed by);
    event ProductFlagged(bytes32 indexed serialHash, address indexed by);

    error NotOwner();
    error NotManufacturer();
    error AlreadyRegistered(bytes32 serialHash);
    error NotFound(bytes32 serialHash);
    error EmptyInput();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyManufacturer() {
        if (!manufacturers[msg.sender]) revert NotManufacturer();
        _;
    }

    constructor() {
        owner = msg.sender;
        manufacturers[msg.sender] = true;
        emit ManufacturerUpdated(msg.sender, true);
    }

    function setManufacturer(address account, bool allowed) external onlyOwner {
        manufacturers[account] = allowed;
        emit ManufacturerUpdated(account, allowed);
    }

    function registerProduct(
        bytes32 serialHash,
        string calldata name,
        string calldata batch,
        string calldata manufacturer
    ) external onlyManufacturer {
        _register(serialHash, name, batch, manufacturer);
    }

    function registerBatch(
        bytes32[] calldata serialHashes,
        string calldata name,
        string calldata batch,
        string calldata manufacturer
    ) external onlyManufacturer {
        if (serialHashes.length == 0) revert EmptyInput();
        for (uint256 i = 0; i < serialHashes.length; i++) {
            _register(serialHashes[i], name, batch, manufacturer);
        }
    }

    function flagProduct(bytes32 serialHash) external onlyManufacturer {
        Product storage p = products[serialHash];
        if (!p.exists) revert NotFound(serialHash);
        p.flagged = true;
        emit ProductFlagged(serialHash, msg.sender);
    }

    function verifyProduct(bytes32 serialHash)
        external
        view
        returns (
            bool exists,
            bool flagged,
            string memory name,
            string memory batch,
            string memory manufacturer,
            uint64 registeredAt,
            address registeredBy
        )
    {
        Product storage p = products[serialHash];
        return (p.exists, p.flagged, p.name, p.batch, p.manufacturer, p.registeredAt, p.registeredBy);
    }

    function _register(bytes32 serialHash, string calldata name, string calldata batch, string calldata manufacturer) internal {
        if (products[serialHash].exists) revert AlreadyRegistered(serialHash);
        products[serialHash] = Product(name, batch, manufacturer, uint64(block.timestamp), msg.sender, true, false);
        totalProducts++;
        emit ProductRegistered(serialHash, name, batch, manufacturer, msg.sender);
    }
}
