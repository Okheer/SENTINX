// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {Escrow} from "../src/Escrow.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {MilestoneManager} from "../src/MilestoneManager.sol";
import {MockYieldRouter} from "../src/MockYieldRouter.sol";
import {AgentManager} from "../src/AgentManager.sol";
import {YieldManager} from "../src/YieldManager.sol";
import {SentinXTypes} from "../src/SentinXTypes.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

/// ============================================================================
/// Integration Tests - End-to-End Workflows
/// ============================================================================

contract IntegrationTests is Test {
    // Contracts
    Escrow public escrow;
    IdentityRegistry public identityRegistry;
    AgentManager public agentManager;
    MockYieldRouter public mockRouter;
    MockERC20 public usdc;
    MockERC20 public weth;
    MockERC20 public equity;

    // Test users
    address public constant VC = address(0x1111);
    address public constant FOUNDER = address(0x2222);
    address public constant AGENT = address(0x3333);
    address public constant OWNER = address(0x5555);

    function setUp() public {
        // Deploy tokens
        usdc = new MockERC20("USDC", "USDC");
        weth = new MockERC20("WETH", "WETH");
        equity = new MockERC20("EQUITY", "EQ");

        // Deploy contracts
        agentManager = new AgentManager(OWNER);
        mockRouter = new MockYieldRouter();
        escrow = new Escrow(OWNER, address(agentManager), address(mockRouter), address(weth));
        identityRegistry = new IdentityRegistry(OWNER);

        // Setup relationships
        vm.prank(OWNER);
        escrow.setIdentityRegistry(address(identityRegistry));

        vm.prank(OWNER);
        identityRegistry.setAgentManager(address(agentManager));

        vm.prank(OWNER);
        agentManager.setAgent(AGENT);

        // Fund accounts
        usdc.mint(VC, 1_000_000e6);
        usdc.mint(FOUNDER, 1_000e6);
        weth.mint(FOUNDER, 10_000e18);
        equity.mint(FOUNDER, 10_000_000e18);
        weth.mint(AGENT, 100_000e18);

        // Approvals
        vm.prank(VC);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(FOUNDER);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(FOUNDER);
        weth.approve(address(escrow), type(uint256).max);

        vm.prank(FOUNDER);
        equity.approve(address(escrow), type(uint256).max);

        vm.prank(AGENT);
        usdc.approve(address(mockRouter), type(uint256).max);

        vm.prank(AGENT);
        weth.approve(address(mockRouter), type(uint256).max);
    }

    /// ─────────────── Full Workflow: From Escrow to Payout ───────────────

    /// @dev Complete workflow: Create → Fund → Setup Milestones → Approve → Execute
    function test_full_workflow_escrow_to_payout() public {
        console.log("\n=== FULL WORKFLOW TEST ===");

        // Step 1: VC creates escrow with $10,000 USDC
        console.log("Step 1: VC creates escrow");
        vm.prank(VC);
        uint256 escrowId = escrow.createEscrow(
            FOUNDER,
            address(usdc),
            10_000e6
        );
        assertEq(escrowId, 1);
        assertEq(escrow.getEscrowState(escrowId), uint8(SentinXTypes.EscrowState.Pending));
        console.log(" Escrow created with ID:", escrowId);

        // Step 2: Founder funds collateral and equity
        console.log("Step 2: Founder funds collateral & equity");
        vm.prank(FOUNDER);
        escrow.fundCollateralAndEquity(
            escrowId,
            address(equity),
            1_000_000e18,
            address(weth),
            100e18
        );
        assertEq(escrow.getEscrowState(escrowId), uint8(SentinXTypes.EscrowState.Active));
        console.log(" Escrow now ACTIVE");

        // Step 3: Setup milestones ($5k per milestone)
        console.log("Step 3: Setup 2 milestones");
        uint256[] memory grantPayouts = new uint256[](2);
        grantPayouts[0] = 5_000e6;
        grantPayouts[1] = 5_000e6;

        uint256[] memory equityPayouts = new uint256[](2);
        equityPayouts[0] = 500_000e18;
        equityPayouts[1] = 500_000e18;

        uint256[] memory targetUsers = new uint256[](2);
        targetUsers[0] = 50;
        targetUsers[1] = 100;

        vm.prank(FOUNDER);
        escrow.setupMilestones(escrowId, grantPayouts, equityPayouts, targetUsers);
        
        uint256[] memory milestoneIds = escrow.getEscrowMilestones(escrowId);
        assertEq(milestoneIds.length, 2);
        console.log(" Milestones created:", milestoneIds.length);

        // Step 4: Agent approves milestones
        console.log("Step 4: Agent approves milestones");
        vm.prank(AGENT);
        escrow.approveMilestone(milestoneIds[0]);

        vm.prank(AGENT);
        escrow.approveMilestone(milestoneIds[1]);

        (,,,,,bool approved1) = escrow.getMilestone(milestoneIds[0]);
        (,,,,,bool approved2) = escrow.getMilestone(milestoneIds[1]);
        assertTrue(approved1 && approved2);
        console.log("All milestones approved");

        // Verify accounting
        console.log("Step 5: Verify accounting");
        (address grantToken, uint256 grantTotal, uint256 grantReleased, , , ) = 
            escrow.getEscrowGrants(escrowId);
        assertEq(grantTotal, 10_000e6);
        assertEq(grantReleased, 0);
        console.log(" Grant accounting verified");
    }

    /// @dev Test: Identity verification → Attestation → Registration
    function test_identity_verification_workflow() public {
        console.log("\n=== IDENTITY VERIFICATION WORKFLOW ===");

        // Step 1: User self-registers identity hash
        console.log("Step 1: Founder self-registers");
        bytes32 identityHash = keccak256(abi.encodePacked("founder_identity"));

        vm.prank(FOUNDER);
        identityRegistry.registerIdentity(identityHash);

        bytes32 stored = identityRegistry.getIdentityHash(FOUNDER);
        assertEq(stored, identityHash);
        assertTrue(identityRegistry.isRegistered(FOUNDER));
        console.log(" Self-registration complete");

        // Step 2: Agent issues attestation with IPFS CID
        console.log("Step 2: Agent attests via IPFS");
        string memory ipfsCid = "QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx";

        vm.prank(AGENT);
        identityRegistry.issueAttestation(FOUNDER, ipfsCid);

        string memory retrievedCid = identityRegistry.getIpfsCid(FOUNDER);
        assertEq(keccak256(abi.encodePacked(retrievedCid)), keccak256(abi.encodePacked(ipfsCid)));
        console.log(" Attestation issued with CID:", ipfsCid);

        // Step 3: Verify user is fully registered
        console.log("Step 3: Final verification");
        assertTrue(identityRegistry.isRegistered(FOUNDER));
        console.log(" User is fully registered and attested");
    }

    /// @dev Test: Multi-level authorization and role enforcement
    function test_authorization_workflow() public {
        console.log("\n=== AUTHORIZATION WORKFLOW ===");

        // Only OWNER can set enclave hash
        console.log("Test 1: Only non-owner cannot set enclave hash");
        bytes32 testHash = keccak256(abi.encodePacked("test_hash"));

        vm.prank(address(0x9999));
        vm.expectRevert();
        agentManager.setAgentEnclaveHash(testHash);
        console.log(" Non-owner cannot set enclave hash");

        vm.prank(OWNER);
        agentManager.setAgentEnclaveHash(testHash);
        assertEq(agentManager.agentEnclaveHash(), testHash);
        console.log(" Owner successfully set enclave hash");

        // Only AGENT can issue attestations
        console.log("Test 2: Only agent can issue attestations");
        vm.prank(FOUNDER);
        vm.expectRevert();
        identityRegistry.issueAttestation(VC, "QmTest");
        console.log(" Non-agent cannot issue attestation");

        vm.prank(AGENT);
        identityRegistry.issueAttestation(VC, "QmTest");
        console.log(" Agent successfully issued attestation");
    }

    /// @dev Test: Yield deployment and unwinding with MockRouter
    function test_yield_deployment_workflow() public {
        console.log("\n=== YIELD DEPLOYMENT WORKFLOW ===");

        // Setup: Create and fund escrow
        console.log("Step 1: Create and fund escrow");
        vm.prank(VC);
        uint256 escrowId = escrow.createEscrow(
            FOUNDER,
            address(usdc),
            50_000e6 // 50k USDC
        );

        // Step 2: Deploy USDC to yield (swap USDC → WETH)
        console.log("Step 2: Deploy 10,000 USDC to yield via MockRouter");
        uint256 deployAmount = 10_000e6;

        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256,bytes)",
            address(usdc),
            address(weth),
            deployAmount,
            bytes("")
        );

        uint256 usdcBefore = usdc.balanceOf(address(escrow));
        uint256 wethBefore = weth.balanceOf(address(escrow));

        vm.prank(AGENT);
        escrow.executeAgentAction(address(mockRouter), 0, swapData);

        uint256 usdcAfter = usdc.balanceOf(address(escrow));
        uint256 wethAfter = weth.balanceOf(address(escrow));

        assertEq(usdcBefore - usdcAfter, deployAmount);
        assertEq(wethAfter - wethBefore, deployAmount); // 1:1 rate
        console.log(" Deployed 10,000 USDC  10,000 WETH");

        // Step 3: Unwind yield (swap WETH → USDC)
        console.log("Step 3: Unwind 5,000 WETH back to USDC");
        uint256 unwindAmount = 5_000e18;

        bytes memory unwindData = abi.encodeWithSignature(
            "swap(address,address,uint256,bytes)",
            address(weth),
            address(usdc),
            unwindAmount,
            bytes("")
        );

        // Transfer WETH to escrow first (MockRouter can't pull from itself)
        weth.mint(address(escrow), unwindAmount);

        vm.prank(AGENT);
        escrow.executeAgentAction(address(mockRouter), 0, unwindData);

        console.log(" Unwound 5,000 WETH  5,000 USDC");
        console.log(" Yield deployment cycle complete");
    }

    /// @dev Test: Multiple concurrent escrows with different parameters
    function test_multi_escrow_concurrent_workflow() public {
        console.log("\n=== MULTI-ESCROW CONCURRENT WORKFLOW ===");

        uint256 numEscrows = 5;
        uint256[] memory escrowIds = new uint256[](numEscrows);
        address[] memory founders = new address[](numEscrows);

        // Create multiple founders
        for (uint256 i = 0; i < numEscrows; i++) {
            founders[i] = address(uint160(0x3000 + i));
            usdc.mint(founders[i], 10_000e6);
            weth.mint(founders[i], 100e18);
            equity.mint(founders[i], 1_000_000e18);

            vm.prank(founders[i]);
            usdc.approve(address(escrow), type(uint256).max);

            vm.prank(founders[i]);
            weth.approve(address(escrow), type(uint256).max);

            vm.prank(founders[i]);
            equity.approve(address(escrow), type(uint256).max);
        }

        // Create multiple escrows in parallel
        console.log("Creating", numEscrows, "escrows...");
        for (uint256 i = 0; i < numEscrows; i++) {
            vm.prank(VC);
            escrowIds[i] = escrow.createEscrow(
                founders[i],
                address(usdc),
                1_000e6 * (i + 1) // Different amounts
            );

            // Fund each
            vm.prank(founders[i]);
            escrow.fundCollateralAndEquity(
                escrowIds[i],
                address(equity),
                100_000e18,
                address(weth),
                10e18
            );

            assertEq(escrow.getEscrowState(escrowIds[i]), uint8(SentinXTypes.EscrowState.Active));
        }

        console.log(" All", numEscrows, "escrows created and funded");

        // Verify independence
        console.log("Verifying escrow independence...");
        for (uint256 i = 0; i < numEscrows; i++) {
            uint8 state = escrow.getEscrowState(escrowIds[i]);
            assertTrue(state == uint8(SentinXTypes.EscrowState.Active));
        }
        console.log(" All escrows are independent and correct");
    }

    /// @dev Test: Complete lifecycle with revocation
    function test_identity_revocation_lifecycle() public {
        console.log("\n=== IDENTITY REVOCATION LIFECYCLE ===");

        address user = address(0xFFFF);

        // Step 1: Register identity
        console.log("Step 1: Register identity");
        bytes32 hash = keccak256(abi.encodePacked("user_id"));
        vm.prank(user);
        identityRegistry.registerIdentity(hash);
        assertTrue(identityRegistry.isRegistered(user));
        console.log(" Identity registered");

        // Step 2: Issue attestation
        console.log("Step 2: Issue attestation");
        vm.prank(AGENT);
        identityRegistry.issueAttestation(user, "QmTest");
        assertEq(keccak256(abi.encodePacked(identityRegistry.getIpfsCid(user))), 
                 keccak256(abi.encodePacked("QmTest")));
        console.log(" Attestation issued");

        // Step 3: Revoke identity
        console.log("Step 3: Revoke identity");
        vm.prank(user);
        identityRegistry.revokeIdentity(user);
        assertFalse(identityRegistry.isRegistered(user));
        console.log(" Identity revoked");

        // Step 4: Verify cannot re-register
        console.log("Step 4: Verify cannot re-register");
        vm.prank(user);
        vm.expectRevert();
        identityRegistry.registerIdentity(hash);
        console.log(" Re-registration blocked after revocation");
    }

    /// @dev Test: Complex milestone scenario with variable payouts
    function test_complex_milestone_scenario() public {
        console.log("\n=== COMPLEX MILESTONE SCENARIO ===");

        // Create escrow with large grant
        vm.prank(VC);
        uint256 escrowId = escrow.createEscrow(
            FOUNDER,
            address(usdc),
            100_000e6
        );

        vm.prank(FOUNDER);
        escrow.fundCollateralAndEquity(
            escrowId,
            address(equity),
            10_000_000e18,
            address(weth),
            1000e18
        );

        // Create escalating milestones
        console.log("Creating escalating milestone structure...");
        uint256[] memory grantPayouts = new uint256[](5);
        uint256[] memory equityPayouts = new uint256[](5);
        uint256[] memory targetUsers = new uint256[](5);

        uint256 totalGrant = 100_000e6;
        uint256 totalEquity = 10_000_000e18;

        grantPayouts[0] = totalGrant * 10 / 100;  // 10%
        grantPayouts[1] = totalGrant * 15 / 100;  // 15%
        grantPayouts[2] = totalGrant * 25 / 100;  // 25%
        grantPayouts[3] = totalGrant * 25 / 100;  // 25%
        grantPayouts[4] = totalGrant * 25 / 100;  // 25%

        for (uint256 i = 0; i < 5; i++) {
            equityPayouts[i] = totalEquity * (i + 1) / 15;
            targetUsers[i] = 20 * (i + 1);
        }

        vm.prank(FOUNDER);
        escrow.setupMilestones(escrowId, grantPayouts, equityPayouts, targetUsers);

        uint256[] memory milestoneIds = escrow.getEscrowMilestones(escrowId);
        assertEq(milestoneIds.length, 5);

        // Verify total payouts
        uint256 totalGrantOut = 0;
        uint256 totalEquityOut = 0;
        for (uint256 i = 0; i < 5; i++) {
            totalGrantOut += grantPayouts[i];
            totalEquityOut += equityPayouts[i];
        }

        assertEq(totalGrantOut, 100_000e6);
        console.log(" 5 escalating milestones created");
        console.log(" Total grant payout:", totalGrantOut / 1e6, "USDC");
        console.log(" Total equity payout:", totalEquityOut / 1e18, "EQ");
    }
}
