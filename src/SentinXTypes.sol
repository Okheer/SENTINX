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
        uint256 yieldBalance;
        uint256 createdAt;
        uint256 deadline;
        bytes32 depositHash;
        address[] depositors;
    }

    struct Milestone {
        uint256 escrowId;           // Which escrow this milestone belongs to
        uint256 payoutAmount;       // How much to payout when claimed
        uint256 targetUsers;        // Target number of verified users
        bool isApproved;            // Agent approval flag
        bool isClaimed;             // Founder claim flag
        uint256 createdAt;          // When milestone was created
    }

    enum EscrowState {
        Active,
        Released,
        Slashed,
        Cancelled
    }
}

