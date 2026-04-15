// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./IIdentityRegistry.sol";
import "./Errors.sol";
import "./AgentManager.sol";

contract IdentityRegistry is IIdentityRegistry {
    address public owner;
    mapping(address => bytes32) private _identityHash;
    mapping(address => bool) private _active;
    mapping(address => bool) private _revoked;
    AgentManager private _agentManager;
    mapping(address => string) private _ipfsCid;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _owner) {
        if (_owner == address(0)) revert InvalidAddress();
        owner = _owner;
    }

    function setAgentManager(address agentManager_) external onlyOwner {
        _agentManager = AgentManager(agentManager_);
    }

    modifier onlyAgent() {
        try _agentManager.isAgent(msg.sender) returns (bool v) {
            if (!v) revert InvalidAgent();
        } catch {
            revert InvalidAgent();
        }
        _;
    }

    function registerIdentity(bytes32 identityHash) external {
        if (identityHash == bytes32(0)) revert InvalidBytes32();
        if (_revoked[msg.sender]) revert RevokedAddress();
        if (_active[msg.sender]) revert AlreadyExists();
        _identityHash[msg.sender] = identityHash;
        _active[msg.sender] = true;
        emit IdentityRegistered(msg.sender, identityHash, msg.sender, block.timestamp);
    }

    function registerIdentityFor(address user, bytes32 identityHash) external onlyOwner {
        if (identityHash == bytes32(0)) revert InvalidBytes32();
        if (_revoked[user]) revert RevokedAddress();
        if (_active[user]) revert AlreadyExists();
        _identityHash[user] = identityHash;
        _active[user] = true;
        emit IdentityRegistered(user, identityHash, msg.sender, block.timestamp);
    }

    /// @notice Agent issues attestation linking user -> IPFS CID. Only callable by agent.
    function issueAttestation(address user, string calldata ipfsCid) external onlyAgent {
        if (user == address(0)) revert InvalidAddress();
        if (bytes(ipfsCid).length == 0) revert InvalidBytes32();
        if (_revoked[user]) revert RevokedAddress();
        _ipfsCid[user] = ipfsCid;
        bytes32 identityHash = keccak256(abi.encodePacked(ipfsCid));
        _identityHash[user] = identityHash;
        _active[user] = true;
        emit IdentityRegistered(user, identityHash, msg.sender, block.timestamp);
    }

    function getIpfsCid(address user) external view returns (string memory) {
        return _ipfsCid[user];
    }

    function revokeIdentity(address user) external {
        if (msg.sender != owner && msg.sender != user) revert Unauthorized();
        delete _identityHash[user];
        _active[user] = false;
        _revoked[user] = true;
        emit IdentityRevoked(user, msg.sender, block.timestamp);
    }

    function isRegistered(address user) external view returns (bool) {
        return _active[user];
    }

    function getIdentityHash(address user) external view returns (bytes32) {
        return _identityHash[user];
    }
}
