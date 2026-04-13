// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./IUniswap.sol";
import "./Errors.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/**
 * @dev YieldManager handles yield deployment and withdrawal via Uniswap V3.
 */
contract YieldManager {
    ISwapRouter public swapRouter;
    IWETH9 public weth;

    mapping(uint256 => address) public yieldTokens; // escrowId => yield token
    mapping(uint256 => uint256) public yieldBalances; // escrowId => yield balance

    event YieldDeployed(uint256 indexed escrowId, uint256 amount, uint256 yieldReceived);
    event YieldWithdrawn(uint256 indexed escrowId, uint256 amount, uint256 tokenReceived);

    constructor(address swapRouter_, address weth_) {
        if (swapRouter_ == address(0)) revert InvalidAddress();
        if (weth_ == address(0)) revert InvalidAddress();
        swapRouter = ISwapRouter(swapRouter_);
        weth = IWETH9(weth_);
    }

    /**
     * @notice Set yield token for an escrow (owner only, called by Escrow).
     */
    function setYieldToken(uint256 escrowId, address yieldToken_) external {
        if (yieldToken_ == address(0)) revert InvalidAddress();
        yieldTokens[escrowId] = yieldToken_;
    }

    /**
     * @notice Deploy funds to yield via Uniswap swap.
     * Note: Caller must transfer tokens to this contract before calling.
     */
    function deployYield(
        uint256 escrowId,
        address tokenIn,
        uint256 amount
    ) external returns (uint256 yieldReceived) {
        if (address(swapRouter) == address(0)) revert InvalidAddress();
        
        address yieldToken = yieldTokens[escrowId];
        if (yieldToken == address(0)) revert Unauthorized();
        if (amount == 0) revert InvalidAmount();

        // Step 1: Prepare token for swap
        address swapTokenIn = tokenIn;
        if (tokenIn == address(0)) {
            // Wrap ETH to WETH
            weth.deposit{value: amount}();
            swapTokenIn = address(weth);
        }

        // Step 2: Approve SwapRouter
        _safeApprove(swapTokenIn, address(swapRouter), amount);

        // Step 3: Execute swap via Uniswap
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: swapTokenIn,
            tokenOut: yieldToken,
            fee: 3000, // 0.3% fee tier
            recipient: address(this),
            deadline: block.timestamp + 60,
            amountIn: amount,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        yieldReceived = swapRouter.exactInputSingle(params);

        // Step 4: Update tracking
        yieldBalances[escrowId] += yieldReceived;

        emit YieldDeployed(escrowId, amount, yieldReceived);
    }

    /**
     * @notice Withdraw yield back to original token.
     * Returns funds to the caller (Escrow contract).
     */
    function withdrawYield(
        uint256 escrowId,
        address tokenOut,
        uint256 amount
    ) external returns (uint256 tokenReceived) {
        address yieldToken = yieldTokens[escrowId];
        if (yieldToken == address(0)) revert Unauthorized();
        if (amount > yieldBalances[escrowId]) revert InsufficientDeposit();
        if (amount == 0) revert InvalidAmount();

        // Step 1: Approve SwapRouter for yield token
        _safeApprove(yieldToken, address(swapRouter), amount);

        // Step 2: Determine swap output
        address swapTokenOut = tokenOut;
        if (tokenOut == address(0)) {
            swapTokenOut = address(weth);
        }

        // Step 3: Swap yield token back
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: yieldToken,
            tokenOut: swapTokenOut,
            fee: 3000,
            recipient: address(this),
            deadline: block.timestamp + 60,
            amountIn: amount,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        tokenReceived = swapRouter.exactInputSingle(params);

        // Step 4: Unwrap WETH to ETH if needed and transfer back
        if (tokenOut == address(0)) {
            weth.withdraw(tokenReceived);
            (bool ok,) = msg.sender.call{value: tokenReceived}("");
            if (!ok) revert TransferFailed();
        } else {
            // Transfer token back to caller
            (bool success, bytes memory data) = tokenOut.call(
                abi.encodeWithSelector(IERC20.transfer.selector, msg.sender, tokenReceived)
            );
            if (!success) revert TransferFailed();
            if (data.length > 0) {
                if (!abi.decode(data, (bool))) revert TransferFailed();
            }
        }

        // Step 5: Update tracking
        yieldBalances[escrowId] -= amount;

        emit YieldWithdrawn(escrowId, amount, tokenReceived);
    }

    /**
     * @notice Get yield info for an escrow.
     */
    function getYieldInfo(uint256 escrowId)
        external
        view
        returns (address yieldToken, uint256 yieldAmount)
    {
        return (yieldTokens[escrowId], yieldBalances[escrowId]);
    }

    // Internal helper
    function _safeApprove(address token, address spender, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, amount)
        );
        if (!success) revert TransferFailed();
        if (data.length > 0) {
            if (!abi.decode(data, (bool))) revert TransferFailed();
        }
    }

    receive() external payable {}
}
