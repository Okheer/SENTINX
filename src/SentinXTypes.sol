// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

library SentinXTypes {
    struct Escrow {
        address payee;
        address agent;
        address token; 
        uint256 totalDeposited;
        mapping(address => uint256) deposits;
        mapping(address => uint256) depositorShares;  // Track depositor's share percentage for yield
        uint256 released; 
        uint256 withdrawn; 
        uint256 yieldBalance;
        uint256 createdAt;
        uint256 deadline;
        bytes32 depositHash;
        address[] depositors;
        uint256 collateralAmount;    // 150 USDC collateral paid by payee
        address collateralToken;     // Token used for collateral (typically USDC)
        uint256 payeeEquityAmount;   // Amount of equity tokens deposited by payee
        address payeeEquityToken;    // Token address for payee's equity
        uint256 uniswapPositionId;   // Uniswap V3 position ID (single position per escrow)
        bool equityDistributed;      // Track if equity tokens have been distributed to depositors
        uint256 totalYieldEarned;    // Track total yield earned from Uniswap
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
        Inactive,
        Active,
        Released,
        Slashed,
        Cancelled
    }

    // ==================== HARD-CODED MILESTONE CONSTANTS ====================
    uint256 constant TOTAL_ESCROW_AMOUNT = 1000e6; // 1000 USDC (6 decimals)
    uint256 constant COLLATERAL_AMOUNT = 150e6;    // 150 USDC collateral from payee
    uint256 constant MILESTONE_1_AMOUNT = 50e6;    // 50 USDC
    uint256 constant MILESTONE_2_AMOUNT = 100e6;   // 100 USDC
    uint256 constant MILESTONE_3_AMOUNT = 300e6;   // 300 USDC
    uint256 constant MILESTONE_4_AMOUNT = 550e6;   // 550 USDC
}

