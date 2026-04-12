// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

library SentinXTypes {
    struct Escrow {
        address payer;
        address payee;
        address agent;
        address token; 
        uint256 totalDeposited;
        mapping(address => uint256) deposits;
        uint256 released; 
        uint256 withdrawn; 
        uint256 createdAt;
        uint256 deadline;
        bytes32 depositHash;
    }
    enum EscrowState {
        Active,
        Released,
        Slashed,
        Cancelled
    }
}

