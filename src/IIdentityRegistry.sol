// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IIdentityRegistry {
    event IdentityRegistered(
        address indexed owner, bytes32 indexed identityHash, address indexed registrar, uint256 timestamp
    );
    event IdentityRevoked(address indexed owner, address indexed revoker, uint256 timestamp);

    function registerIdentity(bytes32 identityHash) external;
    function registerIdentityFor(address owner, bytes32 identityHash) external;
    function revokeIdentity(address owner) external;
    function isRegistered(address owner) external view returns (bool);
    function getIdentityHash(address owner) external view returns (bytes32);
}
