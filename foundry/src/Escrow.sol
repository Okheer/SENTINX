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

    /**
     * @dev Step 1: VC creates escrow and deposits the Grant (e.g., USDC).
     * Escrow is in Pending state until Founder deposits Equity & Collateral.
     */
    function createEscrow(
        address payee,
        address grantToken,
        uint256 grantAmount
    ) external payable nonReentrant returns (uint256) {
        if (grantAmount == 0) revert InvalidAmount();
        if (payee == address(0)) revert Unauthorized();

        if (grantToken == address(0)) {
            if (msg.value != grantAmount) revert InsufficientDeposit();
        } else {
            if (msg.value != 0) revert InvalidAmount();
            _safeTransferFrom(grantToken, msg.sender, address(this), grantAmount);
        }

        uint256 escrowId = nextEscrowId++;
        SentinXTypes.Escrow storage e = escrows[escrowId];
        e.payer = msg.sender;
        e.payee = payee;
        e.grantToken = grantToken;
        e.grantTotal = grantAmount;
        e.grantReleased = 0;
        e.createdAt = block.timestamp;

        // Escrow starts in Pending state, waiting for Founder to deposit Equity & Collateral
        escrowState[escrowId] = SentinXTypes.EscrowState.Pending;

        emit EscrowCreated(escrowId, msg.sender, payee, grantToken, grantAmount);

        return escrowId;
    }

    /**
     * @dev DEMO MODE - Founder deposits Equity & Collateral (flexible amounts).
     * Can be called anytime, even AFTER milestones start (for demo flexibility).
     * Allows founder to deposit arbitrary amounts as a demonstration.
     */
    function fundCollateralAndEquity(
        uint256 escrowId,
        address equityToken,
        uint256 equityAmount,
        address collateralToken,
        uint256 collateralAmount
    ) external nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        if (msg.sender != e.payee) revert Unauthorized();
        if (escrowState[escrowId] == SentinXTypes.EscrowState.Released || 
            escrowState[escrowId] == SentinXTypes.EscrowState.Slashed) revert Unauthorized();
        
        // DEMO MODE: Accept flexible equity amounts (even 0 to just add collateral)
        if (equityAmount > 0) {
            _safeTransferFrom(equityToken, msg.sender, address(this), equityAmount);
            e.equityToken = equityToken;
            e.equityTotal += equityAmount;  // Allow top-ups
            if (e.equityReleased == 0) {
                e.equityReleased = 0;  // Initialize tracking
            }
        }

        if (collateralAmount > 0) {
            _safeTransferFrom(collateralToken, msg.sender, address(this), collateralAmount);
            e.collateralToken = collateralToken;
            e.collateralTotal += collateralAmount;  // Allow top-ups
        }

        // Auto-activate if both equity and collateral are now funded
        if (escrowState[escrowId] == SentinXTypes.EscrowState.Pending && 
            e.equityTotal > 0 && e.collateralTotal > 0) {
            escrowState[escrowId] = SentinXTypes.EscrowState.Active;
        }

        emit FounderFunded(escrowId, equityToken, equityAmount, collateralToken, collateralAmount);
    }



    // ==================== MILESTONE DELEGATION ====================

    function setupMilestones(
        uint256 escrowId,
        uint256[] calldata grantPayouts,
        uint256[] calldata equityPayouts,
        uint256[] calldata targetUsers
    ) external onlyOwner {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        // DEMO: Allow setup on Pending state (auto-activate for demo convenience)
        if (escrowState[escrowId] == SentinXTypes.EscrowState.Released || 
            escrowState[escrowId] == SentinXTypes.EscrowState.Slashed) revert Unauthorized();

        uint256 totalGrantPayout = 0;
        uint256 totalEquityPayout = 0;
        for (uint256 i = 0; i < grantPayouts.length; i++) {
            totalGrantPayout += grantPayouts[i];
            totalEquityPayout += equityPayouts[i];
        }
        if (totalGrantPayout > e.grantTotal) revert InsufficientDeposit();
        // DEMO: Don't validate equity payout amounts - founder can deposit flexible amounts

        milestoneManager.createMilestones(escrowId, grantPayouts, equityPayouts, targetUsers);
        
        // DEMO: Auto-activate on setupMilestones for convenience
        // Founder can deposit equity/collateral anytime before first claim
        if (escrowState[escrowId] == SentinXTypes.EscrowState.Pending) {
            escrowState[escrowId] = SentinXTypes.EscrowState.Active;
        }
    }

    /**
     * @dev DEMO VERSION: Claims the milestone payout.
     * 
     * Founder receives agreed grant amount.
     * VC receives agreed equity amount + any leftover equity (yield profits).
     * On final milestone: Collateral returns to Founder (Diamond Hands reward).
     */
    function claimMilestonePayout(uint256 milestoneId) external nonReentrant {
        (uint256 escrowId, uint256 grantPayout, uint256 equityPayout, , bool isApproved, bool isClaimed,) = 
            milestoneManager.getMilestone(milestoneId);

        if (!isApproved) revert Unauthorized();
        if (isClaimed) revert Unauthorized();

        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        if (msg.sender != e.payee) revert Unauthorized();
        if (escrowState[escrowId] != SentinXTypes.EscrowState.Active) revert Unauthorized();

        // CHECK 1: Founder MUST have deposited equity and collateral by now
        if (e.equityTotal == 0 || e.collateralTotal == 0) {
            revert InvalidAmount();  // ERROR MESSAGE: "Call fundCollateralAndEquity first"
        }

        // CHECK 2: Sufficient grant to pay founder
        if (e.grantReleased + grantPayout > e.grantTotal) revert InsufficientDeposit();

        // Mark as claimed
        milestoneManager.claimMilestone(milestoneId);

        // STEP 1: Pay Founder the agreed grant amount
        e.grantReleased += grantPayout;
        _transferOut(e.grantToken, e.payee, grantPayout);

        // STEP 2: Pay VC the agreed equity amount  
        e.equityReleased += equityPayout;
        _transferOut(e.equityToken, e.payer, equityPayout);

        // STEP 3: Check if this is the FINAL milestone (all grant released == total grant)
        // This is calculated mathematically - founder CANNOT cheat by claiming early!
        bool isFinal = (e.grantReleased >= e.grantTotal);

        // STEP 4: On FINAL milestone only:
        // - Return founder's collateral (Diamond Hands reward for not rugging)
        // - Send any leftover equity to VC as yield profit
        if (isFinal) {
            // Return the collateral to founder
            _transferOut(e.collateralToken, e.payee, e.collateralTotal);
            
            // Send any extra equity (beyond agreed amounts) to VC as yield profit
            uint256 extraEquity = e.equityTotal - e.equityReleased;
            if (extraEquity > 0) {
                _transferOut(e.equityToken, e.payer, extraEquity);
            }
            
            escrowState[escrowId] = SentinXTypes.EscrowState.Released;
            emit DiamondHandUnlock(escrowId, e.payee, e.collateralTotal);
        }

        emit MilestonePayout(milestoneId, e.payee, grantPayout, equityPayout);
    }

    /**
     * @dev The Ultimate Slashing Function: Agent nukes the Founder if they rug.
     * VC gets refund + collateral as penalty, Founder gets back worthless equity.
     */
    function slashFounder(uint256 escrowId, string calldata reason) external onlyAgent nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        if (escrowState[escrowId] != SentinXTypes.EscrowState.Active) revert Unauthorized();

        uint256 remainingGrant = e.grantTotal - e.grantReleased;
        uint256 remainingEquity = e.equityTotal - e.equityReleased;

        // 1. Refund VC their remaining USDC
        _transferOut(e.grantToken, e.payer, remainingGrant);

        // 2. Send Founder's Collateral to VC as penalty fee
        _transferOut(e.collateralToken, e.payer, e.collateralTotal);

        // 3. Return the worthless Equity back to the Founder
        _transferOut(e.equityToken, e.payee, remainingEquity);

        escrowState[escrowId] = SentinXTypes.EscrowState.Slashed;

        emit FounderSlashed(escrowId, e.payer, e.collateralTotal, remainingGrant, reason);
    }

    function approveMilestone(uint256 milestoneId) external onlyAgent {
        milestoneManager.approveMilestone(milestoneId);
    }

    function getMilestone(uint256 milestoneId) external view returns (
        uint256 escrowId,
        uint256 grantPayout,
        uint256 equityPayout,
        uint256 targetUsers,
        bool isApproved,
        bool isClaimed
    ) {
        (escrowId, grantPayout, equityPayout, targetUsers, isApproved, isClaimed,) = 
            milestoneManager.getMilestone(milestoneId);
    }

    function getEscrowMilestones(uint256 escrowId) external view returns (uint256[] memory) {
        return milestoneManager.getEscrowMilestones(escrowId);
    }

    function getMilestoneStatus(uint256 escrowId) external view returns (
        uint256 totalMilestones,
        uint256 approvedCount,
        uint256 claimedCount,
        uint256 totalGrantPayout,
        uint256 totalEquityPayout
    ) {
        return milestoneManager.getMilestoneStatus(escrowId);
    }

    function setYieldToken(uint256 escrowId, address yieldToken_) external onlyOwner {
        yieldManager.setYieldToken(escrowId, yieldToken_);
    }

    function deployYield(uint256 escrowId, uint256 amount) external onlyAgent nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        if (escrowState[escrowId] != SentinXTypes.EscrowState.Active) revert Unauthorized();

        uint256 available = e.grantTotal - e.grantReleased;
        if (amount > available) revert InsufficientDeposit();

        yieldManager.deployYield(escrowId, e.grantToken, amount);
        
        emit YieldDeployed(escrowId, amount);
    }

    /**
     * @dev CRITICAL FIX: Withdraw yield - ONLY profit goes to VC, principal stays in escrow!
     * 
     * Example:
     *   Deploy: 5,000 USDC
     *   Receive back: 5,050 USDC (5,000 principal + 50 profit)
     *   
     *    VC gets: 50 USDC (ONLY the profit)
     *    Escrow keeps: 5,000 USDC (principal for founder payouts)
     */
    function withdrawYield(uint256 escrowId, uint256 amount) external onlyAgent nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        // Security pattern: Only withdraw from Active escrows
        if (escrowState[escrowId] != SentinXTypes.EscrowState.Active) revert Unauthorized();

        uint256 tokenReceived = yieldManager.withdrawYield(escrowId, e.grantToken, amount);
        
        // CRITICAL FIX: Send ONLY the profit (tokenReceived - amount), not the full amount!
        // Principal automatically stays in escrow for founder payouts
        if (tokenReceived > amount) {
            uint256 profit = tokenReceived - amount;
            _transferOut(e.grantToken, e.payer, profit);
        }
        // If tokenReceived <= amount (swap lost money), nothing sent to VC

        emit YieldWithdrawn(escrowId, tokenReceived);
    }

    /**
     * @dev Execute arbitrary calldata on behalf of the agent.
     * Used by agent to execute swaps via MockYieldRouter or other protocols.
     * 
     * Example flow:
     *   1. Agent calls (off-chain): onchainos swap swap --from USDC --to WETH ...
     *   2. Agent parses returned calldata
     *   3. Agent calls this function: executeAgentAction(mockRouterAddr, 0, calldata)
     *   4. Escrow makes the call: (success, result) = mockRouterAddr.call(calldata)
     */
    function executeAgentAction(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyAgent nonReentrant returns (bytes memory) {
        require(target != address(0), "Target cannot be zero address");

        // Execute the call
        (bool success, bytes memory result) = target.call{value: value}(data);
        
        if (!success) {
            if (result.length > 0) {
                assembly {
                    let returndata_size := mload(result)
                    revert(add(32, result), returndata_size)
                }
            } else {
                revert("Agent action failed");
            }
        }

        return result;
    }

    function getYieldInfo(uint256 escrowId) external view returns (address yieldToken, uint256 yieldAmount) {
        return yieldManager.getYieldInfo(escrowId);
    }


    /**
     * @dev Returns the complete Triple-Lock escrow state.
     */
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
        )
    {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        grantToken = e.grantToken;
        grantTotal = e.grantTotal;
        grantReleased = e.grantReleased;
        equityToken = e.equityToken;
        equityTotal = e.equityTotal;
        equityReleased = e.equityReleased;
    }


    /// @notice Get collateral details for an escrow 
    function getEscrowCollateral(uint256 escrowId)
        external
        view
        returns (
            address collateralToken,
            uint256 collateralTotal,
            uint256 createdAt
        )
    {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        collateralToken = e.collateralToken;
        collateralTotal = e.collateralTotal;
        createdAt = e.createdAt;
    }

    /// @notice Get basic escrow details: participants and token addresses
    function getEscrowParties(uint256 escrowId)
        external
        view
        returns (
            address payer,
            address payee
        )
    {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
        payer = e.payer;
        payee = e.payee;
    }



    function getEscrowState(uint256 escrowId) external view returns (uint8) {
        return uint8(escrowState[escrowId]);
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
