// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IEscrow {
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed payer,
        address indexed payee,
        address agent,
        address token,
        uint256 amount,
        uint256 deadline,
        bytes32 depositHash
    );
    event Deposited(uint256 indexed escrowId, address indexed from, uint256 amount);
    event Released(uint256 indexed escrowId, address indexed to, uint256 amount);
    event Withdrawn(uint256 indexed escrowId, address indexed by, uint256 amount);
    event Slashed(uint256 indexed escrowId, address indexed to, uint256 amount, string reason);
    event EscrowCancelled(uint256 indexed escrowId, address indexed by);

    function createEscrow(address payee, address token, uint256 amount, uint256 deadline, bytes32 depositHash)
        external
        payable
        returns (uint256);
    function deposit(uint256 escrowId, uint256 amount) external payable;
    function release(uint256 escrowId, uint256 amount) external;
    function withdraw(uint256 escrowId, uint256 amount) external;
    function slash(uint256 escrowId, address to, uint256 amount, string calldata reason) external;
    function cancel(uint256 escrowId) external;

    // view helpers
    function getEscrow(uint256 escrowId) external view returns (
        address payer,
        address payee,
        address agent,
        address token,
        uint256 totalDeposited,
        uint256 released,
        uint256 withdrawn,
        uint256 createdAt,
        uint256 deadline,
        bytes32 depositHash
    );

    function getEscrowState(uint256 escrowId) external view returns (uint8);
}
