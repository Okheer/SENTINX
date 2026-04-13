// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./SentinXTypes.sol";
import "./Errors.sol";

/**
 * @dev MilestoneManager handles milestone creation, approval, and payouts.
 * Independent from Escrow but coordinated through it.
 */
contract MilestoneManager {
    uint256 public nextMilestoneId;
    mapping(uint256 => SentinXTypes.Milestone) public milestones;
    mapping(uint256 => uint256[]) public escrowMilestones; // escrowId => milestone IDs

    event MilestoneCreated(uint256 indexed milestoneId, uint256 indexed escrowId, uint256 payoutAmount, uint256 targetUsers);
    event MilestoneApproved(uint256 indexed milestoneId, address indexed agent);
    event MilestonePayout(uint256 indexed milestoneId, address indexed founder, uint256 amount);

    constructor() {
        nextMilestoneId = 1;
    }

    /**
     * @notice Create milestones for an escrow.
     * @param escrowId The escrow these milestones belong to
     * @param payoutAmounts Array of payout amounts for each milestone
     * @param targetUsers Array of target user counts for each milestone
     * @return milestoneIds Array of created milestone IDs
     */
    function createMilestones(
        uint256 escrowId,
        uint256[] calldata payoutAmounts,
        uint256[] calldata targetUsers
    ) external returns (uint256[] memory milestoneIds) {
        if (payoutAmounts.length != targetUsers.length) revert InvalidAmount();
        if (payoutAmounts.length == 0) revert InvalidAmount();

        milestoneIds = new uint256[](payoutAmounts.length);

        for (uint256 i = 0; i < payoutAmounts.length; i++) {
            if (payoutAmounts[i] == 0) revert InvalidAmount();
            if (targetUsers[i] == 0) revert InvalidAmount();

            uint256 milestoneId = nextMilestoneId++;
            milestones[milestoneId] = SentinXTypes.Milestone({
                escrowId: escrowId,
                payoutAmount: payoutAmounts[i],
                targetUsers: targetUsers[i],
                isApproved: false,
                isClaimed: false,
                createdAt: block.timestamp
            });

            escrowMilestones[escrowId].push(milestoneId);
            milestoneIds[i] = milestoneId;
            emit MilestoneCreated(milestoneId, escrowId, payoutAmounts[i], targetUsers[i]);
        }
    }

    /**
     * @notice Approve a milestone (agent action after verification).
     */
    function approveMilestone(uint256 milestoneId) external {
        SentinXTypes.Milestone storage m = milestones[milestoneId];
        if (m.escrowId == 0 && milestoneId != 0) revert MilestoneNotFound();
        if (m.isApproved) revert MilestoneAlreadyApproved();

        m.isApproved = true;
        emit MilestoneApproved(milestoneId, msg.sender);
    }

    /**
     * @notice Mark milestone as claimed (called by Escrow after payout).
     */
    function claimMilestone(uint256 milestoneId) external {
        SentinXTypes.Milestone storage m = milestones[milestoneId];
        if (m.escrowId == 0 && milestoneId != 0) revert MilestoneNotFound();
        if (!m.isApproved) revert MilestoneNotApproved();
        if (m.isClaimed) revert MilestoneAlreadyClaimed();

        m.isClaimed = true;
    }

    /**
     * @notice Get milestone details.
     */
    function getMilestone(uint256 milestoneId)
        external
        view
        returns (
            uint256 escrowId,
            uint256 payoutAmount,
            uint256 targetUsers,
            bool isApproved,
            bool isClaimed,
            uint256 createdAt
        )
    {
        SentinXTypes.Milestone storage m = milestones[milestoneId];
        return (m.escrowId, m.payoutAmount, m.targetUsers, m.isApproved, m.isClaimed, m.createdAt);
    }

    /**
     * @notice Get all milestone IDs for an escrow.
     */
    function getEscrowMilestones(uint256 escrowId) external view returns (uint256[] memory) {
        return escrowMilestones[escrowId];
    }

    /**
     * @notice Get milestone status summary for an escrow.
     */
    function getMilestoneStatus(uint256 escrowId)
        external
        view
        returns (
            uint256 totalMilestones,
            uint256 approvedCount,
            uint256 claimedCount,
            uint256 totalPayoutAmount
        )
    {
        uint256[] memory milestoneIds = escrowMilestones[escrowId];
        totalMilestones = milestoneIds.length;
        uint256 approved = 0;
        uint256 claimed = 0;
        uint256 totalPayout = 0;

        for (uint256 i = 0; i < milestoneIds.length; i++) {
            SentinXTypes.Milestone storage m = milestones[milestoneIds[i]];
            if (m.isApproved) approved++;
            if (m.isClaimed) claimed++;
            totalPayout += m.payoutAmount;
        }

        return (totalMilestones, approved, claimed, totalPayout);
    }
}
