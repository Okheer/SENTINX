// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./Errors.sol";

/**
 * @dev Minimal AgentManager for a single hardcoded agent.
 * The `agent` address can be set in the constructor (placeholder) or updated
 * later by the `owner` via `setAgent` if needed. The actual agent address
 * intended for production may be hardcoded by you later.
 */
contract AgentManager {
    address public owner;
    address public agent; 
    bytes32 public agentEnclaveHash;

    event AgentSet(address indexed agent);
    event AgentEnclaveHashSet(address indexed agent, bytes32 enclaveHash);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

        // NOTE: agent address is hardcoded for this sprint — replace if needed.
        constructor(address _owner) {
            if (_owner == address(0)) revert InvalidAddress();
            owner = _owner;
            agent = 0x0c0EB8960f029F6D321CBEd125d9d240B7Eb773C;
            emit AgentSet(agent);
        }


    /// @notice Owner sets an attestation/enclave hash for the agent
    function setAgentEnclaveHash(bytes32 enclaveHash) external onlyOwner {
        if (enclaveHash == bytes32(0)) revert InvalidEnclaveHash();
        agentEnclaveHash = enclaveHash;
        emit AgentEnclaveHashSet(agent, enclaveHash);
    }

    function isAgent(address _agent) external view returns (bool) {
        return _agent == agent;
    }

    function agentEnclaveHashOf(address _agent) external view returns (bytes32) {
        if (_agent != agent) return bytes32(0);
        return agentEnclaveHash;
    }
}
