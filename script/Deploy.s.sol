// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/AgentManager.sol";
import "../src/IdentityRegistry.sol";
import "../src/Escrow.sol";

/**
 * @title SentinX Deploy Script
 *
 * HOW TO RUN
 * ──────────
 * Anvil (local test):
 *   anvil                        ← start local chain in one terminal
 *   forge script script/Deploy.s.sol \
 *       --rpc-url http://127.0.0.1:8545 \
 *       --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
 *       --broadcast -vvvv
 *   (^ that private key is Anvil's default test account #0 — never use on mainnet)
 *
 * Testnet / Mainnet:
 *   forge script script/Deploy.s.sol \
 *       --rpc-url <YOUR_RPC_URL> \
 *       --private-key <YOUR_PRIVATE_KEY> \
 *       --broadcast -vvvv
 *
 * NO .env FILE NEEDED.
 * Just paste your private key and RPC directly in the command above, or
 * use a hardware wallet flag like --ledger instead.
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT GETS DEPLOYED
 * ─────────────────────────────────────────────────────────────────
 *  1. AgentManager        (needs: your deployer address as owner)
 *  2. IdentityRegistry    (needs: your deployer address as owner)
 *  3. IdentityRegistry.setAgentManager(agentManager)
 *  4. Escrow              (needs: owner, agentManager, swapRouter, weth)
 *                          internally deploys MilestoneManager + YieldManager
 *  5. Escrow.setIdentityRegistry(identityRegistry)
 *  6. Escrow.setUniswapConfig(positionManager, factory, usdc, fee)
 * ─────────────────────────────────────────────────────────────────
 */
contract DeploySentinX is Script {

    // ─────────────────────────────────────────────────────────────
    // PICK YOUR CHAIN — uncomment ONE block, comment the rest
    // ─────────────────────────────────────────────────────────────

    // ── Ethereum Mainnet ─────────────────────────────────────────
    // address constant SWAP_ROUTER      = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    // address constant POSITION_MANAGER = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    // address constant UNISWAP_FACTORY  = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    // address constant WETH             = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    // address constant USDC             = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // ── Base Mainnet ─────────────────────────────────────────────
    // address constant SWAP_ROUTER      = 0x2626664c2603336E57B271c5C0b26F421741e481;
    // address constant POSITION_MANAGER = 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1;
    // address constant UNISWAP_FACTORY  = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    // address constant WETH             = 0x4200000000000000000000000000000000000006;
    // address constant USDC             = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    // ── Base Sepolia (testnet) — ACTIVE ──────────────────────────
    address constant SWAP_ROUTER      = 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4;
    address constant POSITION_MANAGER = 0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2;
    address constant UNISWAP_FACTORY  = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address constant WETH             = 0x4200000000000000000000000000000000000006;
    address constant USDC             = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // ── Sepolia ──────────────────────────────────────────────────
    // address constant SWAP_ROUTER      = 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48;
    // address constant POSITION_MANAGER = 0x1238536071E1c677A632429e3655c799b22cDA52;
    // address constant UNISWAP_FACTORY  = 0x0227628f3F023bb0B980b67D528571c95c6DaC1c;
    // address constant WETH             = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    // address constant USDC             = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    // Pool fee: 500 = 0.05%  |  3000 = 0.3%  |  10000 = 1%
    uint24 constant UNISWAP_POOL_FEE = 3000;

    // ─────────────────────────────────────────────────────────────

    function run() external {
        // deployer = whoever passes --private-key in the forge command
        address deployer = msg.sender;

        vm.startBroadcast();

        // ── 1. AgentManager ───────────────────────────────────────
        // Constructor:  AgentManager(address _owner)
        // Hardcodes agent = 0x0c0EB8960f029F6D321CBEd125d9d240B7Eb773C inside
        AgentManager agentManager = new AgentManager(deployer);
        console.log("AgentManager     :", address(agentManager));
        console.log("  owner          :", agentManager.owner());
        console.log("  agent          :", agentManager.agent());

        // ── 2. IdentityRegistry ───────────────────────────────────
        // Constructor:  IdentityRegistry(address _owner)
        IdentityRegistry identityRegistry = new IdentityRegistry(deployer);
        console.log("IdentityRegistry :", address(identityRegistry));

        // ── 3. Wire AgentManager into IdentityRegistry ────────────
        // Required so issueAttestation() only works for the agent
        identityRegistry.setAgentManager(address(agentManager));
        console.log("  setAgentManager -> done");

        // ── 4. Escrow ─────────────────────────────────────────────
        // Constructor:  Escrow(owner, agentManager, swapRouter, weth)
        // Internally runs:
        //   new MilestoneManager()
        //   milestoneManager.setEscrowContract(address(this))
        //   new YieldManager(swapRouter, weth)
        Escrow escrow = new Escrow(
            deployer,
            address(agentManager),
            SWAP_ROUTER,
            WETH
        );
        console.log("Escrow           :", address(escrow));
        console.log("  MilestoneManager:", address(escrow.milestoneManager()));
        console.log("  YieldManager    :", address(escrow.yieldManager()));

        // ── 5. Wire IdentityRegistry into Escrow ─────────────────
        // Escrow checks identityRegistry.isRegistered(payee) before release()
        escrow.setIdentityRegistry(address(identityRegistry));
        console.log("  setIdentityRegistry -> done");

        // ── 6. Wire Uniswap V3 into Escrow ───────────────────────
        // Used by _deployToUniswap() when escrow reaches 1000 USDC
        escrow.setUniswapConfig(
            POSITION_MANAGER,
            UNISWAP_FACTORY,
            USDC,
            UNISWAP_POOL_FEE
        );
        console.log("  setUniswapConfig -> done");

        vm.stopBroadcast();

        console.log("\n========== DEPLOYED ADDRESSES ==========");
        console.log("AgentManager     :", address(agentManager));
        console.log("IdentityRegistry :", address(identityRegistry));
        console.log("Escrow           :", address(escrow));
        console.log("MilestoneManager :", address(escrow.milestoneManager()));
        console.log("YieldManager     :", address(escrow.yieldManager()));
        console.log("=========================================");
    }
}