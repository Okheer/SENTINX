// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IEscrow {
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed payee,
        address agent,
        address equityToken,
        uint256 collateralAmount,
        address collateralToken
    );
    event CollateralDeposited(uint256 indexed escrowId, address indexed payee, uint256 amount);
    event PayeeEquityDeposited(uint256 indexed escrowId, address indexed payee, uint256 amount);
    event CollateralReturned(uint256 indexed escrowId, address indexed payee, uint256 amount);
    event Deposited(uint256 indexed escrowId, address indexed from, uint256 amount);
    event DepositRefunded(uint256 indexed escrowId, address indexed depositor, uint256 amount);
    event Released(uint256 indexed escrowId, address indexed to, uint256 amount);
    event Withdrawn(uint256 indexed escrowId, address indexed by, uint256 amount);
    event Slashed(uint256 indexed escrowId, address indexed to, uint256 amount, string reason);
    event YieldDeployed(uint256 indexed escrowId, uint256 amount);
    event YieldWithdrawn(uint256 indexed escrowId, uint256 amount);
    event YieldDistributed(uint256 indexed escrowId, address indexed depositor, uint256 amount);
    event EquityTokensDistributed(uint256 indexed escrowId, address indexed depositor, uint256 amount);
    event EscrowActivated(uint256 indexed escrowId);
    event UniswapPositionCreated(uint256 indexed escrowId, uint256 indexed positionId, uint256 amount);
    event UniswapPositionClosed(uint256 indexed escrowId, uint256 indexed positionId, uint256 amount);
    event RefundClaimed(uint256 indexed escrowId, address indexed depositor, uint256 amount);
    event MilestoneClaimed(uint256 indexed escrowId, address indexed payee, uint256 amount);
    event MilestoneCreated(uint256 indexed milestoneId, uint256 indexed escrowId, uint256 payoutAmount, uint256 targetUsers);
    event MilestoneApproved(uint256 indexed milestoneId, address indexed agent);
    event MilestonePayout(uint256 indexed milestoneId, address indexed founder, uint256 amount);

    function createEscrow(uint256 collateralAmount, address collateralToken, uint256 equityAmount, address equityToken)
        external
        payable
        returns (uint256);
    function deposit(uint256 escrowId, uint256 amount) external payable;
    function cancelAndRefund(uint256 escrowId) external;
    function release(uint256 escrowId, uint256 amount) external;
    function withdraw(uint256 escrowId, uint256 amount) external;
    function slash(uint256 escrowId, address to, uint256 amount, string calldata reason) external;
    function returnCollateral(uint256 escrowId) external;
    function getDepositorAmount(uint256 escrowId, address depositor) external view returns (uint256);
    function isPayeeRegistered(uint256 escrowId) external view returns (bool);

    // Milestone functions
    function setupMilestones(uint256 escrowId, uint256[] calldata payoutAmounts, uint256[] calldata targetUsers) external;
    function approveMilestone(uint256 milestoneId) external;
    function claimMilestonePayout(uint256 milestoneId) external;
    function getMilestone(uint256 milestoneId) external view returns (
        uint256 escrowId,
        uint256 payoutAmount,
        uint256 targetUsers,
        bool isApproved,
        bool isClaimed
    );
    function getEscrowMilestones(uint256 escrowId) external view returns (uint256[] memory);

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
