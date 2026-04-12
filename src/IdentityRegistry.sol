// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./IIdentityRegistry.sol";
import "./Errors.sol";

contract IdentityRegistry is IIdentityRegistry {
    address public owner;
    mapping(address => bytes32) private _identityHash;
    mapping(address => bool) private _active;
    mapping(address => bool) private _revoked;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _owner) {
        if (_owner == address(0)) revert InvalidAddress();
        owner = _owner;
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
