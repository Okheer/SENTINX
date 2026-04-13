// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./SentinXTypes.sol";
import "./IEscrow.sol";
import "./IIdentityRegistry.sol";
import "./Errors.sol";
import "./AgentManager.sol";
import "./MilestoneManager.sol";
import "./YieldManager.sol";
import "./IUniswapV3.sol";
import "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";

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
    mapping(address => bool) public payeeHasEscrow;  // One escrow per payee restriction

    // Uniswap V3 configuration
    INonfungiblePositionManager public nonfungiblePositionManager;
    IUniswapV3Factory public uniswapFactory;
    address public usdcToken;  // USDC token address
    address public wethToken;  // WETH token address
    uint24 public uniswapFee;  // Pool fee (e.g., 3000 for 0.3%)

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
        if (_owner == address(0)) revert InvalidAddress();
        if (agentManager_ == address(0)) revert InvalidAddress();
        
        owner = _owner;
        _agentManager = AgentManager(agentManager_);
        milestoneManager = new MilestoneManager();
        milestoneManager.setEscrowContract(address(this)); // Set back-reference for auto-release
        yieldManager = new YieldManager(swapRouter_, weth_);
        wethToken = weth_;
        nextEscrowId = 65384561832458;
    }

    // ==================== CONFIGURATION ====================

    function setIdentityRegistry(address registry_) external onlyOwner {
        identityRegistry = registry_;
    }

    function setUniswapConfig(
        address positionManager_,
        address factory_,
        address usdc_,
        uint24 fee_
    ) external onlyOwner {
        if (positionManager_ == address(0)) revert InvalidAddress();
        if (factory_ == address(0)) revert InvalidAddress();
        if (usdc_ == address(0)) revert InvalidAddress();
        
        nonfungiblePositionManager = INonfungiblePositionManager(positionManager_);
        uniswapFactory = IUniswapV3Factory(factory_);
        usdcToken = usdc_;
        uniswapFee = fee_;
    }

    function setAgentManager(address agentManager_) external onlyOwner {
        _agentManager = AgentManager(agentManager_);
    }

    // ==================== CORE ESCROW FUNCTIONS ====================
    //
    /**
     * @notice Create a new escrow. Payee calls this with their 150 USDC collateral and equity tokens.
     * @param collateralAmount Must be exactly 150 USDC
     * @param collateralToken Token address for collateral (typically USDC)
     * @param equityAmount Amount of equity tokens payee is depositing
     * @param equityToken The token address for equity tokens
     */
    function createEscrow(
        uint256 collateralAmount,
        address collateralToken,
        uint256 equityAmount,
        address equityToken
    ) external payable nonReentrant returns (uint256) {
        // One escrow per payee restriction
        if (payeeHasEscrow[msg.sender]) revert Unauthorized();
        
        // Collateral must be exactly 150 USDC
        if (collateralAmount != SentinXTypes.COLLATERAL_AMOUNT) revert InvalidAmount();
        if (equityAmount == 0) revert InvalidAmount();
        
        if (collateralToken == address(0)) {
            if (msg.value != collateralAmount) revert InsufficientDeposit();
        } else {
            if (msg.value != 0) revert InvalidAmount();
            _safeTransferFrom(collateralToken, msg.sender, address(this), collateralAmount);
        }

        // Transfer equity tokens from payee to escrow
        if (equityToken == address(0)) {
            revert InvalidAddress(); // Equity token must not be ETH
        } else {
            _safeTransferFrom(equityToken, msg.sender, address(this), equityAmount);
        }

        uint256 escrowId = nextEscrowId++;
        SentinXTypes.Escrow storage e = escrows[escrowId];
        e.payee = msg.sender;
        e.agent = 0x0c0EB8960f029F6D321CBEd125d9d240B7Eb773C;
        e.token = equityToken;
        e.collateralAmount = collateralAmount;
        e.collateralToken = collateralToken;
        e.payeeEquityAmount = equityAmount;
        e.payeeEquityToken = equityToken;
        e.totalDeposited = 0;
        e.released = 0;
        e.withdrawn = 0;
        e.createdAt = block.timestamp;
        e.deadline = 0;
        e.depositHash = bytes32(0);
        e.uniswapPositionId = 0;  // Will be set when escrow becomes Active
        e.equityDistributed = false;
        e.totalYieldEarned = 0;

        // Mark that this payee has created an escrow (one per payee)
        payeeHasEscrow[msg.sender] = true;

        // Start in Inactive state (will transition to Active when totalDeposited == 1000 USDC)
        escrowState[escrowId] = SentinXTypes.EscrowState.Inactive;

        // Auto-create the 4 hard-coded milestones
        uint256[] memory payoutAmounts = new uint256[](4);
        payoutAmounts[0] = SentinXTypes.MILESTONE_1_AMOUNT;
        payoutAmounts[1] = SentinXTypes.MILESTONE_2_AMOUNT;
        payoutAmounts[2] = SentinXTypes.MILESTONE_3_AMOUNT;
        payoutAmounts[3] = SentinXTypes.MILESTONE_4_AMOUNT;

        uint256[] memory targetUsers = new uint256[](4);
        // targetUsers can be any non-zero value; for now use default 1
        targetUsers[0] = 50;
        targetUsers[1] = 100;
        targetUsers[2] = 300;
        targetUsers[3] = 550;

        milestoneManager.createMilestones(escrowId, payoutAmounts, targetUsers);

        emit EscrowCreated(escrowId, msg.sender, msg.sender, equityToken, equityToken, collateralAmount, 0, bytes32(0));
        emit CollateralDeposited(escrowId, msg.sender, collateralAmount);
        emit PayeeEquityDeposited(escrowId, msg.sender, equityAmount);

        return escrowId;
    }

    /**
     * @notice Deposit funds into an escrow. Anyone can call this to contribute.
     * Payouts will go to the escrow's payee when milestones are completed.
     */
    function deposit(uint256 escrowId, uint256 amount) external payable nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payee == address(0)) revert EscrowNotFound();
        if (amount == 0) revert InvalidAmount();

        // Check that deposit won't exceed 1000 USDC total
        if (e.totalDeposited + amount > SentinXTypes.TOTAL_ESCROW_AMOUNT) revert EscrowIsLOcked();

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

        // Check if escrow should be activated (totalDeposited == 1000 USDC)
        _checkAndActivateEscrow(escrowId);

        emit Deposited(escrowId, msg.sender, amount);
    }

    /**
     * @notice Cancel escrow and refund depositor (only when Inactive).
     * Depositor must not have left already and escrow must not be Active yet.
     */
    function cancelAndRefund(uint256 escrowId) external nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payee == address(0)) revert EscrowNotFound();
        if (escrowState[escrowId] != SentinXTypes.EscrowState.Inactive) revert Unauthorized();
        
        uint256 depositorAmount = e.deposits[msg.sender];
        if (depositorAmount == 0) revert InvalidAmount();
        
        // Clear the deposit
        e.deposits[msg.sender] = 0;
        
        // Reduce total deposited
        e.totalDeposited -= depositorAmount;
        
        // Remove from depositors list
        for (uint256 i = 0; i < e.depositors.length; i++) {
            if (e.depositors[i] == msg.sender) {
                e.depositors[i] = e.depositors[e.depositors.length - 1];
                e.depositors.pop();
                break;
            }
        }
        
        // Refund the depositor
        _transferOut(e.token, msg.sender, depositorAmount);
        
        emit DepositRefunded(escrowId, msg.sender, depositorAmount);
    }

    //
    function release(uint256 escrowId, uint256 amount) external nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payee == address(0)) revert EscrowNotFound();
        if (escrowState[escrowId] != SentinXTypes.EscrowState.Active) revert Unauthorized();

        if (!(isAgent(msg.sender))) revert Unauthorized();

        if (identityRegistry != address(0)) {
            try IIdentityRegistry(identityRegistry).isRegistered(e.payee) returns (bool registered) {
                if (!registered) revert Unauthorized();
            } catch {
                revert Unauthorized();
            }
        }

        if (e.released + amount > e.totalDeposited) revert InsufficientDeposit();
        
        // Withdraw the required amount from Uniswap
        if (e.uniswapPositionId != 0 && address(nonfungiblePositionManager) != address(0)) {
            _withdrawFromUniswap(escrowId, amount);
        }
        
        e.released += amount;

        emit Released(escrowId, e.payee, amount);
    }

    //
    function withdraw(uint256 escrowId, uint256 amount) external nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payee == address(0)) revert EscrowNotFound();
        if (msg.sender != e.payee) revert Unauthorized();
        uint256 available = e.released - e.withdrawn;
        if (amount > available) revert InsufficientDeposit();

        e.withdrawn += amount;
        if (e.withdrawn == e.totalDeposited) escrowState[escrowId] = SentinXTypes.EscrowState.Released;

        _transferOut(e.token, msg.sender, amount);

        emit Withdrawn(escrowId, msg.sender, amount);
    }

    // ==================== INTERNAL HELPERS ====================

    /**
     * @notice Check if escrow should be activated (when totalDeposited == 1000 USDC).
     * Transitions from Inactive to Active state when the condition is met.
     */
    /**
     * @notice Internal helper to check and activate escrow, distribute equity, and deploy to Uniswap.
     * Transitions from Inactive to Active when totalDeposited == 1000 USDC.
     * Distributes equity tokens to depositors proportionally.
     */
    function _checkAndActivateEscrow(uint256 escrowId) internal {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (escrowState[escrowId] == SentinXTypes.EscrowState.Inactive && 
            e.totalDeposited == SentinXTypes.TOTAL_ESCROW_AMOUNT) {
            
            // Transition to Active
            escrowState[escrowId] = SentinXTypes.EscrowState.Active;
            
            // Calculate and store depositor shares (as percentages in basis points)
            for (uint256 i = 0; i < e.depositors.length; i++) {
                address depositor = e.depositors[i];
                uint256 depositAmount = e.deposits[depositor];
                // Store share as percentage with 18 decimals (e.g., 50% = 5000000000000000000)
                e.depositorShares[depositor] = (depositAmount * 1e18) / SentinXTypes.TOTAL_ESCROW_AMOUNT;
            }
            
            // Distribute equity tokens proportionally to depositors
            if (e.payeeEquityAmount > 0 && !e.equityDistributed) {
                for (uint256 i = 0; i < e.depositors.length; i++) {
                    address depositor = e.depositors[i];
                    uint256 share = e.depositorShares[depositor];
                    uint256 equityToDistribute = (e.payeeEquityAmount * share) / 1e18;
                    
                    if (equityToDistribute > 0) {
                        _transferOut(e.payeeEquityToken, depositor, equityToDistribute);
                        emit EquityTokensDistributed(escrowId, depositor, equityToDistribute);
                    }
                }
                e.equityDistributed = true;
            }
            
            // Deploy 1000 USDC to Uniswap V3
            _deployToUniswap(escrowId);
            
            emit EscrowActivated(escrowId);
        }
    }

    //
    function slash(uint256 escrowId, address to, uint256 amount, string calldata reason) external nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payee == address(0)) revert EscrowNotFound();

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

    /**
     * @notice Return the 150 USDC collateral to payee after all 4 milestones are claimed.
     * Only the payee can call this function.
     */
    /**
     * @notice Return collateral to payee after all milestones are claimed.
     * Also withdraws all remaining funds from Uniswap and distributes yield to depositors.
     */
    function returnCollateral(uint256 escrowId) external nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payee == address(0)) revert EscrowNotFound();
        if (msg.sender != e.payee) revert Unauthorized();
        
        // Check if all 4 milestones are claimed
        uint256[] memory milestoneIds = milestoneManager.getEscrowMilestones(escrowId);
        if (milestoneIds.length != 4) revert InvalidAmount();
        
        for (uint256 i = 0; i < milestoneIds.length; i++) {
            (,,, , bool isClaimed, ) = milestoneManager.getMilestone(milestoneIds[i]);
            if (!isClaimed) revert Unauthorized(); // Not all milestones claimed yet
        }
        
        // Collateral must not have been already returned
        if (e.collateralAmount == 0) revert InvalidAmount();
        
        // Withdraw all remaining funds from Uniswap and collect yield
        uint256 remainingFromUniswap = 0;
        if (e.uniswapPositionId != 0 && address(nonfungiblePositionManager) != address(0)) {
            remainingFromUniswap = _withdrawAllFromUniswap(escrowId);
        }
        
        // Distribute yield to depositors proportionally
        if (remainingFromUniswap > 0) {
            for (uint256 i = 0; i < e.depositors.length; i++) {
                address depositor = e.depositors[i];
                uint256 depositorShare = e.depositorShares[depositor];
                uint256 yieldForDepositor = (remainingFromUniswap * depositorShare) / 1e18;
                
                if (yieldForDepositor > 0) {
                    _transferOut(usdcToken, depositor, yieldForDepositor);
                    emit YieldDistributed(escrowId, depositor, yieldForDepositor);
                }
            }
        }
        
        // Return collateral to payee
        uint256 collateralToReturn = e.collateralAmount;
        e.collateralAmount = 0; // Mark as returned to prevent double returns
        
        _transferOut(e.collateralToken, e.payee, collateralToReturn);
        
        emit CollateralReturned(escrowId, e.payee, collateralToReturn);
    }

    // ==================== MILESTONE DELEGATION ====================

    //
    function approveMilestone(uint256 milestoneId) external onlyAgent {
        milestoneManager.approveMilestone(milestoneId);
    }
    //
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

    //
    function getMilestone(uint256 milestoneId) external view returns (
        uint256 escrowId,
        uint256 payoutAmount,
        uint256 targetUsers,
        bool isApproved,
        bool isClaimed
    ) {
        (escrowId, payoutAmount, targetUsers, isApproved, isClaimed,) = 
            milestoneManager.getMilestone(milestoneId);
        return (escrowId, payoutAmount, targetUsers, isApproved, isClaimed);
    }
    //
    function getEscrowMilestones(uint256 escrowId) external view returns (uint256[] memory) {
        return milestoneManager.getEscrowMilestones(escrowId);
    }
    //
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
        if (e.payee == address(0)) revert EscrowNotFound();

        uint256 available = e.totalDeposited - e.released;
        if (amount > available) revert InsufficientDeposit();

        // Transfer funds to YieldManager first
        if (e.token == address(0)) {
            // Send ETH to YieldManager
            (bool ok,) = address(yieldManager).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            // Transfer ERC20 tokens to YieldManager
            _safeTransferFrom(e.token, address(this), address(yieldManager), amount);
        }

        yieldManager.deployYield(escrowId, e.token, amount);
        
        emit YieldDeployed(escrowId, amount);
    }

    function withdrawYield(uint256 escrowId, uint256 amount) external onlyAgent nonReentrant {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payee == address(0)) revert EscrowNotFound();

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
            address payee,
            address agent,
            address token,
            uint256 totalDeposited,
            uint256 released,
            uint256 withdrawn,
            uint256 createdAt,
            uint256 collateralAmount
        )
    {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payee == address(0)) revert EscrowNotFound();
        return (
            e.payee,
            e.agent,
            e.token,
            e.totalDeposited,
            e.released,
            e.withdrawn,
            e.createdAt,
            e.collateralAmount
        );
    }

    function getEscrowState(uint256 escrowId) external view returns (uint8) {
        return uint8(escrowState[escrowId]);
    }

    function getDepositorAmount(uint256 escrowId, address depositor) external view returns (uint256) {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payee == address(0)) revert EscrowNotFound();
        return e.deposits[depositor];
    }

    function isPayeeRegistered(uint256 escrowId) external view returns (bool) {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payee == address(0)) revert EscrowNotFound();
        if (identityRegistry == address(0)) return true;
        try IIdentityRegistry(identityRegistry).isRegistered(e.payee) returns (bool v) {
            return v;
        } catch {
            return false;
        }
    }

    function getDepositors(uint256 escrowId) external view returns (address[] memory) {
        SentinXTypes.Escrow storage e = escrows[escrowId];
        if (e.payee == address(0)) revert EscrowNotFound();
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

    // ==================== UNISWAP V3 FUNCTIONS ====================

    /**
     * @notice Deploy 1000 USDC to Uniswap V3 in a USDC-only tick range above current price.
     * This creates a liquidity position that only contains USDC, protecting against price movement.
     */
    function _deployToUniswap(uint256 escrowId) internal {
        require(address(nonfungiblePositionManager) != address(0), "Uniswap not configured");
        
        SentinXTypes.Escrow storage e = escrows[escrowId];
        
        // Get the current price from USDC/WETH pool
        address poolAddress = uniswapFactory.getPool(usdcToken, wethToken, uniswapFee);
        require(poolAddress != address(0), "Pool does not exist");
        
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        (uint160 sqrtPriceX96, int24 currentTick, , , , , ) = pool.slot0();
        
        // Create a tick range ABOVE current price (only USDC liquidity)
        // Space ticks by typical spacing (e.g., 60 for 0.01% pools, 200 for 1% pools)
        int24 tickSpacing = int24(uniswapFee == 500 ? 10 : uniswapFee == 3000 ? 60 : 200);
        int24 tickLower = ((currentTick / tickSpacing) + 1) * tickSpacing;
        int24 tickUpper = tickLower + (tickSpacing * 100);  // Wide range above current price
        
        // Approve the 1000 USDC for the position manager
        IERC20(usdcToken).approve(address(nonfungiblePositionManager), SentinXTypes.TOTAL_ESCROW_AMOUNT);
        
        // Mint the position
        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: usdcToken < wethToken ? usdcToken : wethToken,
            token1: usdcToken < wethToken ? wethToken : usdcToken,
            fee: uniswapFee,
            tickLower: usdcToken < wethToken ? tickLower : -tickUpper,
            tickUpper: usdcToken < wethToken ? tickUpper : -tickLower,
            amount0Desired: usdcToken < wethToken ? SentinXTypes.TOTAL_ESCROW_AMOUNT : 0,
            amount1Desired: usdcToken < wethToken ? 0 : SentinXTypes.TOTAL_ESCROW_AMOUNT,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this),
            deadline: block.timestamp + 300
        });
        
        (uint256 positionId, , , ) = nonfungiblePositionManager.mint(mintParams);
        e.uniswapPositionId = positionId;
        
        emit UniswapPositionCreated(escrowId, positionId, SentinXTypes.TOTAL_ESCROW_AMOUNT);
    }

    /**
     * @notice Withdraw a specific amount from Uniswap position (when milestones are claimed).
     * Collects fees and withdraws liquidity as needed.
     */
    function _withdrawFromUniswap(uint256 escrowId, uint256 amountNeeded) internal returns (uint256 amountWithdrawn) {
        require(address(nonfungiblePositionManager) != address(0), "Uniswap not configured");
        
        SentinXTypes.Escrow storage e = escrows[escrowId];
        require(e.uniswapPositionId != 0, "No Uniswap position");
        
        uint256 positionId = e.uniswapPositionId;
        
        // Collect accumulated fees/yield
        INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
            tokenId: positionId,
            recipient: address(this),
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });
        
        (uint256 amount0, uint256 amount1) = nonfungiblePositionManager.collect(collectParams);
        uint256 collected = (usdcToken < wethToken) ? amount0 : amount1;
        
        // Track yield earned
        e.totalYieldEarned += collected;
        
        // If we need more USDC, decrease liquidity
        if (collected < amountNeeded) {
            // Calculate how much liquidity to remove (simplified - remove proportional amount)
            uint256 needed = amountNeeded - collected;
            
            // Get current position info
            (,, , , , ,, uint128 liquidity, , , , ) = nonfungiblePositionManager.positions(positionId);
            
            // Decrease liquidity proportionally
            uint128 liquidityToRemove = uint128((uint256(liquidity) * needed) / SentinXTypes.TOTAL_ESCROW_AMOUNT);
            
            if (liquidityToRemove > 0) {
                INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = 
                    INonfungiblePositionManager.DecreaseLiquidityParams({
                        tokenId: positionId,
                        liquidity: liquidityToRemove,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: block.timestamp + 300
                    });
                
                nonfungiblePositionManager.decreaseLiquidity(decreaseParams);
                
                // Collect the withdrawn amount
                (amount0, amount1) = nonfungiblePositionManager.collect(collectParams);
                uint256 withdrawn = (usdcToken < wethToken) ? amount0 : amount1;
                amountWithdrawn = collected + withdrawn;
            } else {
                amountWithdrawn = collected;
            }
        } else {
            amountWithdrawn = collected;
        }
    }

    /**
     * @notice Withdraw all remaining liquidity and yield from Uniswap position (called on returnCollateral).
     * Removes all liquidity, collects all fees, burns the position, and returns total USDC amount.
     */
    function _withdrawAllFromUniswap(uint256 escrowId) internal returns (uint256 totalWithdrawn) {
        require(address(nonfungiblePositionManager) != address(0), "Uniswap not configured");
        
        SentinXTypes.Escrow storage e = escrows[escrowId];
        require(e.uniswapPositionId != 0, "No Uniswap position");
        
        uint256 positionId = e.uniswapPositionId;
        
        // Get current position info
        (,, , , , ,, uint128 liquidity, , , , ) = nonfungiblePositionManager.positions(positionId);
        
        // Decrease ALL liquidity
        if (liquidity > 0) {
            INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = 
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: positionId,
                    liquidity: liquidity,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp + 300
                });
            
            nonfungiblePositionManager.decreaseLiquidity(decreaseParams);
        }
        
        // Collect all remaining amounts
        INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
            tokenId: positionId,
            recipient: address(this),
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });
        
        (uint256 amount0, uint256 amount1) = nonfungiblePositionManager.collect(collectParams);
        
        // Get USDC amount (handle both token orders)
        totalWithdrawn = (usdcToken < wethToken) ? amount0 : amount1;
        
        // Burn the position NFT
        nonfungiblePositionManager.burn(positionId);
        e.uniswapPositionId = 0;
        
        emit UniswapPositionClosed(escrowId, positionId, totalWithdrawn);
    }

    receive() external payable {}
}
