// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

library SentinXTypes {
    struct Escrow {
        address payer;
        address payee;
        address agent;
        address token; // address(0) === native ETH
        uint256 amount;
        uint256 released; // amount approved for payee to withdraw
        uint256 withdrawn; // amount already withdrawn by payee
        uint256 createdAt;
        uint256 deadline;
        bytes32 depositHash; // keccak256 of off-chain evidence / IPFS CID
    }
    enum EscrowState {
        Active,
        Released,
        Slashed,
        Cancelled
    }
}

