// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./SentinXTypes.sol";
import "./IEscrow.sol";
import "./IIdentityRegistry.sol";
import "./Errors.sol";
import "./AgentManager.sol";
import "./MilestoneManager.sol";
import "./YieldManager.sol";
import "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/**
 * @dev Core Escrow contract. Coordinates with MilestoneManager and YieldManager.
 */
contract Escrow is IEscrow, ReentrancyGuard {
    using SentinXTypes for SentinXTypes.Escrow;

    address public owner;
    AgentManager private _agentManager;
    address public identityRegistry;
    MilestoneManager public milestoneManager;
    YieldManager public yieldManager;

    uint256 public nextEscrowId;
    mapping(uint256 => SentinXTypes.Escrow) public escrows;
    mapping(uint256 => SentinXTypes.EscrowState) public escrowState;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAgent() {
        if (!isAgent(msg.sender)) revert InvalidAgent();
        _;
    }

    constructor(
        address _owner,
        address agentManager_,
        address swapRouter_,
        address weth_
    ) {
        owner = _owner;
        _agentManager = AgentManager(agentManager_);
        milestoneManager = new MilestoneManager();
        yieldManager = new YieldManager(swapRouter_, weth_);
        nextEscrowId = 1;
    }

    // ==================== CONFIGURATION ====================

    function setIdentityRegistry(address registry_) external onlyOwner {
        identityRegistry = registry_;
    }

    function setAgentManager(address agentManager_) external onlyOwner {
        _agentManager = AgentManager(agentManager_);
    }

    // ==================== CORE ESCROW FUNCTIONS ====================

    function createEscrow(
        address payee,
        address token,
        uint256 amount,
        uint256 deadline,
        bytes32 depositHash
    ) external payable nonReentrant returns (uint256) {
        if (amount == 0) revert InvalidAmount();

        if (token == address(0)) {
            if (msg.value != amount) revert InsufficientDeposit();
        } else {
            if (msg.value != 0) revert InvalidAmount();
            _safeTransferFrom(token, msg.sender, address(this), amount);
        }

        uint256 escrowId = nextEscrowId++;
        SentinXTypes.Escrow storage e = escrows[escrowId];
        e.payer = msg.sender;
        e.payee = payee;
        e.agent = address(0);
        e.token = token;
        e.totalDeposited = amount;
        e.released = 0;
        e.withdrawn = 0;
        e.createdAt = block.timestamp;
        e.deadline = deadline;
        e.depositHash = depositHash;

        e.deposits[msg.sender] = amount;
        e.depositors.push(msg.sender);

        escrowState[escrowId] = SentinXTypes.EscrowState.Active;

        emit EscrowCreated(escrowId, msg.sender, payee, address(0), token, amount, deadline, depositHash);
        emit Deposited(escrowId, msg.sender, amount);

        return escrowId;
    }

    function deposit(uint256 escrowId, uint256 amount) external payable nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        if (amount == 0) revert InvalidAmount();

        bool isNewDepositor = e.deposits[msg.sender] == 0;

        if (e.token == address(0)) {
            if (msg.value != amount) revert InsufficientDeposit();
            e.totalDeposited += msg.value;
            e.deposits[msg.sender] += msg.value;
        } else {
            if (msg.value != 0) revert InvalidAmount();
            _safeTransferFrom(e.token, msg.sender, address(this), amount);
            e.totalDeposited += amount;
            e.deposits[msg.sender] += amount;
        }

        if (isNewDepositor) {
            e.depositors.push(msg.sender);
        }

        emit Deposited(escrowId, msg.sender, amount);
    }

    function release(uint256 escrowId, uint256 amount) external nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        if (escrowState[escrowId] != SentinXTypes.EscrowState.Active) revert Unauthorized();

        if (!(isAgent(msg.sender) || msg.sender == owner)) revert Unauthorized();

        if (identityRegistry != address(0)) {
            try IIdentityRegistry(identityRegistry).isRegistered(e.payee) returns (bool registered) {
                if (!registered) revert Unauthorized();
            } catch {
                revert Unauthorized();
            }
        }

        if (e.released + amount > e.totalDeposited) revert InsufficientDeposit();
        e.released += amount;

        emit Released(escrowId, e.payee, amount);
    }

    function withdraw(uint256 escrowId, uint256 amount) external nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        if (msg.sender != e.payee) revert Unauthorized();
        uint256 available = e.released - e.withdrawn;
        if (amount > available) revert InsufficientDeposit();

        e.withdrawn += amount;
        if (e.withdrawn == e.totalDeposited) escrowState[escrowId] = SentinXTypes.EscrowState.Released;

        _transferOut(e.token, msg.sender, amount);

        emit Withdrawn(escrowId, msg.sender, amount);
    }

    function slash(uint256 escrowId, address to, uint256 amount, string calldata reason) external nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();

        if (!isAgent(msg.sender)) revert InvalidAgent();

        uint256 available = e.totalDeposited - e.released;
        if (amount > available) revert InsufficientDeposit();

        e.totalDeposited -= amount;
        if (e.totalDeposited == e.released && e.released == e.withdrawn) {
            escrowState[escrowId] = SentinXTypes.EscrowState.Slashed;
        }

        _transferOut(e.token, to, amount);

        emit Slashed(escrowId, to, amount, reason);
    }

    function cancel(uint256 escrowId) external nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        if (msg.sender != e.payer && msg.sender != owner) revert Unauthorized();
        if (escrowState[escrowId] != SentinXTypes.EscrowState.Active) revert Unauthorized();

        escrowState[escrowId] = SentinXTypes.EscrowState.Cancelled;
        emit EscrowCancelled(escrowId, msg.sender);
    }

    function claimRefund(uint256 escrowId) external nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        if (escrowState[escrowId] != SentinXTypes.EscrowState.Cancelled && 
            escrowState[escrowId] != SentinXTypes.EscrowState.Slashed) {
            revert Unauthorized();
        }

        uint256 deposited = e.deposits[msg.sender];
        if (deposited == 0) revert InvalidAmount();

        uint256 unclaimed = e.totalDeposited - e.released;
        uint256 refund = (unclaimed > 0) ? (deposited * unclaimed / e.totalDeposited) : 0;

        e.deposits[msg.sender] = 0;

        if (refund > 0) {
            _transferOut(e.token, msg.sender, refund);
        }

        emit RefundClaimed(escrowId, msg.sender, refund);
    }

    // ==================== MILESTONE DELEGATION ====================

    function setupMilestones(
        uint256 escrowId,
        uint256[] calldata payoutAmounts,
        uint256[] calldata targetUsers
    ) external onlyOwner {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();

        uint256 totalPayout = 0;
        for (uint256 i = 0; i < payoutAmounts.length; i++) {
            totalPayout += payoutAmounts[i];
        }
        if (totalPayout > e.totalDeposited) revert InsufficientDeposit();

        milestoneManager.createMilestones(escrowId, payoutAmounts, targetUsers);
    }

    function approveMilestone(uint256 milestoneId) external onlyAgent {
        milestoneManager.approveMilestone(milestoneId);
    }

    function claimMilestonePayout(uint256 milestoneId) external nonReentrant {
        (uint256 escrowId, uint256 payoutAmount, , bool isApproved, bool isClaimed,) = 
            milestoneManager.getMilestone(milestoneId);

        if (!isApproved) revert Unauthorized();
        if (isClaimed) revert Unauthorized();

        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (msg.sender != e.payee) revert Unauthorized();

        milestoneManager.claimMilestone(milestoneId);
        _transferOut(e.token, e.payee, payoutAmount);
        e.withdrawn += payoutAmount;

        emit MilestonePayout(milestoneId, e.payee, payoutAmount);
    }

    function getMilestone(uint256 milestoneId) external view returns (
        uint256 escrowId,
        uint256 payoutAmount,
        uint256 targetUsers,
        bool isApproved,
        bool isClaimed
    ) {
        (escrowId, payoutAmount, targetUsers, isApproved, isClaimed,) = 
            milestoneManager.getMilestone(milestoneId);
    }

    function getEscrowMilestones(uint256 escrowId) external view returns (uint256[] memory) {
        return milestoneManager.getEscrowMilestones(escrowId);
    }

    function getMilestoneStatus(uint256 escrowId) external view returns (
        uint256 totalMilestones,
        uint256 approvedCount,
        uint256 claimedCount,
        uint256 totalPayoutAmount
    ) {
        return milestoneManager.getMilestoneStatus(escrowId);
    }

    // ==================== YIELD DELEGATION ====================

    function setYieldToken(uint256 escrowId, address yieldToken_) external onlyOwner {
        yieldManager.setYieldToken(escrowId, yieldToken_);
    }

    function deployYield(uint256 escrowId, uint256 amount) external onlyAgent nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();

        uint256 available = e.totalDeposited - e.released;
        if (amount > available) revert InsufficientDeposit();

        yieldManager.deployYield(escrowId, e.token, amount);
        
        emit YieldDeployed(escrowId, amount);
    }

    function withdrawYield(uint256 escrowId, uint256 amount) external onlyAgent nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();

        uint256 tokenReceived = yieldManager.withdrawYield(escrowId, e.token, amount);
        e.totalDeposited += tokenReceived;

        emit YieldWithdrawn(escrowId, tokenReceived);
    }

    function getYieldInfo(uint256 escrowId) external view returns (address yieldToken, uint256 yieldAmount) {
        return yieldManager.getYieldInfo(escrowId);
    }

    // ==================== VIEW HELPERS ====================

    function getEscrow(uint256 escrowId)
        external
        view
        returns (
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
        )
    {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        return (
            e.payer,
            e.payee,
            e.agent,
            e.token,
            e.totalDeposited,
            e.released,
            e.withdrawn,
            e.createdAt,
            e.deadline,
            e.depositHash
        );
    }

    function getEscrowState(uint256 escrowId) external view returns (uint8) {
        return uint8(escrowState[escrowId]);
    }

    function getDepositorAmount(uint256 escrowId, address depositor) external view returns (uint256) {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        return e.deposits[depositor];
    }

    function isPayeeRegistered(uint256 escrowId) external view returns (bool) {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        if (identityRegistry == address(0)) return true;
        try IIdentityRegistry(identityRegistry).isRegistered(e.payee) returns (bool v) {
            return v;
        } catch {
            return false;
        }
    }

    function getDepositors(uint256 escrowId) external view returns (address[] memory) {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        return e.depositors;
    }

    // ==================== INTERNAL HELPERS ====================

    function isAgent(address who) public view returns (bool) {
        try _agentManager.isAgent(who) returns (bool v) {
            return v;
        } catch {
            return false;
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
        if (!success) revert TransferFailed();
        if (data.length > 0) {
            if (!abi.decode(data, (bool))) revert TransferFailed();
        }
    }

    function _transferOut(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            (bool success, bytes memory data) = token.call(
                abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
            );
            if (!success) revert TransferFailed();
            if (data.length > 0) {
                if (!abi.decode(data, (bool))) revert TransferFailed();
            }
        }
    }

    receive() external payable {}
}
