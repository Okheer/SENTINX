// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IEscrow {
    // ==================== TRIPLE-LOCK EVENTS ====================
    
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed vc,
        address indexed founder,
        address grantToken,
        uint256 grantAmount
    );

    event FounderFunded(
        uint256 indexed escrowId,
        address equityToken,
        uint256 equityAmount,
        address collateralToken,
        uint256 collateralAmount
    );

    event MilestoneCreated(
        uint256 indexed milestoneId,
        uint256 indexed escrowId,
        uint256 grantPayout,
        uint256 equityPayout,
        uint256 targetUsers
    );

    event MilestoneApproved(uint256 indexed milestoneId, address indexed agent);

    event MilestonePayout(
        uint256 indexed milestoneId,
        address indexed founder,
        uint256 grantAmount,
        uint256 equityAmount
    );

    event DiamondHandUnlock(
        uint256 indexed escrowId,
        address indexed founder,
        uint256 collateralAmount
    );

    event FounderSlashed(
        uint256 indexed escrowId,
        address indexed vc,
        uint256 collateralSeized,
        uint256 grantRefunded,
        string reason
    );

    event YieldDeployed(uint256 indexed escrowId, uint256 amount);
    event YieldWithdrawn(uint256 indexed escrowId, uint256 amount);

    // ==================== CORE ESCROW FUNCTIONS ====================

    // Step 1: VC creates escrow and funds the Grant
    function createEscrow(
        address payee,
        address grantToken,
        uint256 grantAmount
    ) external payable returns (uint256);

    // Step 2: Founder deposits Equity & Collateral
    function fundCollateralAndEquity(
        uint256 escrowId,
        address equityToken,
        uint256 equityAmount,
        address collateralToken,
        uint256 collateralAmount
    ) external;

    // ==================== MILESTONE FUNCTIONS ====================

    function setupMilestones(
        uint256 escrowId,
        uint256[] calldata grantPayouts,
        uint256[] calldata equityPayouts,
        uint256[] calldata targetUsers
    ) external;

    function approveMilestone(uint256 milestoneId) external;

    // Founder claims milestone - triggers atomic swap (grant to founder, equity to VC)
    // Contract calculates if final milestone internally (when all grant released)
    function claimMilestonePayout(uint256 milestoneId) external;

    // Agent slashes founder - sends collateral to VC as penalty
    function slashFounder(uint256 escrowId, string calldata reason) external;

    // ==================== VIEW HELPERS ====================

    function getMilestone(uint256 milestoneId)
        external
        view
        returns (
            uint256 escrowId,
            uint256 grantPayout,
            uint256 equityPayout,
            uint256 targetUsers,
            bool isApproved,
            bool isClaimed
        );

    function getEscrowMilestones(uint256 escrowId) external view returns (uint256[] memory);

    function getMilestoneStatus(uint256 escrowId)
        external
        view
        returns (
            uint256 totalMilestones,
            uint256 approvedCount,
            uint256 claimedCount,
            uint256 totalGrantPayout,
            uint256 totalEquityPayout
        );

    function getEscrowState(uint256 escrowId) external view returns (uint8);

    function isPayeeRegistered(uint256 escrowId) external view returns (bool);

    // Yield functions
    function setYieldToken(uint256 escrowId, address yieldToken_) external;

    function deployYield(uint256 escrowId, uint256 amount) external;

    function withdrawYield(uint256 escrowId, uint256 amount) external;

    function getYieldInfo(uint256 escrowId) external view returns (address yieldToken, uint256 yieldAmount);

    function getEscrowGrants(uint256 escrowId)
        external
        view
        returns (
            address grantToken,
            uint256 grantTotal,
            uint256 grantReleased,
            address equityToken,
            uint256 equityTotal,
            uint256 equityReleased
        );

    function getEscrowCollateral(uint256 escrowId)
        external
        view
        returns (
            address collateralToken,
            uint256 collateralTotal,
            uint256 createdAt
        );

    function getEscrowParties(uint256 escrowId)
        external
        view
        returns (
            address payer,
            address payee
        );
}
