// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library SentinXTypes {
    struct Escrow {
        address payer;              // The VC
        address payee;              // The Founder
        
        // 1. The Grant (VC's Money)
        address grantToken;         // e.g., USDC
        uint256 grantTotal;
        uint256 grantReleased;
        
        // 2. The Equity (Founder's Token)
        address equityToken;        // e.g., $STARTUP
        uint256 equityTotal;
        uint256 equityReleased;
        
        // 3. The Collateral (Founder's Skin in the Game)
        address collateralToken;    // e.g., WETH
        uint256 collateralTotal;
        
        uint256 createdAt;
    }

    struct Milestone {
        uint256 escrowId;           // Which escrow this milestone belongs to
        uint256 grantPayout;        // USDC going to Founder
        uint256 equityPayout;       // $STARTUP going to VC
        uint256 targetUsers;        // Target number of verified users
        bool isApproved;            // Agent approval flag
        bool isClaimed;             // Founder claim flag
        uint256 createdAt;          // When milestone was created
    }

    enum EscrowState {
        Pending,    // Awaiting founder to deposit collateral & equity
        Active,     // Both sides funded, agent can work
        Released,   // All milestones claimed, funds released
        Slashed,    // Agent slashed the founder
        Cancelled   // Founder cancelled before activation
    }
}

