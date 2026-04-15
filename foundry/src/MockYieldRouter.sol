// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockYieldRouter
 * @dev A simplified mock DEX router for hackathon demo.
 * Executes fixed-rate swaps between any two tokens without slippage-related failures.
 * 1 input token = 1 output token (simplified rate for demo predictability).
 */
contract MockYieldRouter {
    using SafeERC20 for IERC20;

    event MockSwap(
        address indexed fromToken,
        address indexed toToken,
        uint256 amount,
        address indexed caller
    );

    /**
     * @dev Performs a fixed-rate token swap. Caller must approve tokens first.
     * @param fromToken Source token address
     * @param toToken Target token address
     * @param amount Amount of fromToken to swap (simplified: 1:1 rate)
     * @param _okxData OKX serialized data (ignored in mock - for compatibility)
     */
    function swap(
        address fromToken,
        address toToken,
        uint256 amount,
        bytes calldata _okxData  // Ignored—just for OKX calldata compatibility
    ) external {
        require(amount > 0, "Amount must be > 0");
        require(fromToken != address(0), "Invalid fromToken");
        require(toToken != address(0), "Invalid toToken");

        // Step 1: Transfer fromToken from caller to this contract
        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amount);

        // Step 2: Transfer toToken back to caller (simplified 1:1 rate)
        IERC20(toToken).safeTransfer(msg.sender, amount);

        emit MockSwap(fromToken, toToken, amount, msg.sender);
    }

    /**
     * @dev Allows contract to receive ERC20 tokens via approve + transferFrom.
     * (No receive() needed since we use safeTransferFrom)
     */
    function recoverToken(address token, uint256 amount) external {
        // Simple recovery for dust—only owner should call in production
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
