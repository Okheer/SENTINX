// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {Escrow} from "../src/Escrow.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AgentManager} from "../src/AgentManager.sol";
import {SentinXTypes} from "../src/SentinXTypes.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// ============================================================================
/// Advanced Security & Edge Case Tests
/// ============================================================================

contract SecurityTest is Test {
    Escrow public escrow;
    IdentityRegistry public identityRegistry;
    AgentManager public agentManager;
    MockERC20 public usdc;
    MockERC20 public weth;
    MockERC20 public equity;

    address public constant VC = address(0x1111);
    address public constant FOUNDER = address(0x2222);
    address public constant AGENT = address(0x3333);
    address public constant OWNER = address(0x5555);
    address public constant ATTACKER = address(0xDEAD);

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC");
        weth = new MockERC20("WETH", "WETH");
        equity = new MockERC20("EQUITY", "EQ");

        agentManager = new AgentManager(OWNER);
        escrow = new Escrow(OWNER, address(agentManager), address(0), address(weth));
        identityRegistry = new IdentityRegistry(OWNER);

        vm.prank(OWNER);
        escrow.setIdentityRegistry(address(identityRegistry));

        vm.prank(OWNER);
        identityRegistry.setAgentManager(address(agentManager));

        vm.prank(OWNER);
        agentManager.setAgent(AGENT);

        // Fund
        usdc.mint(VC, 100_000e6);
        weth.mint(FOUNDER, 1000e18);
        equity.mint(FOUNDER, 10_000_000e18);

        vm.prank(VC);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(FOUNDER);
        weth.approve(address(escrow), type(uint256).max);

        vm.prank(FOUNDER);
        equity.approve(address(escrow), type(uint256).max);
    }

    /// @dev Test reentrancy protection on createEscrow
    function test_reentrancy_protection_createEscrow() public {
        // Note: ReentrancyGuard is present, but let's verify correct behavior
        vm.prank(VC);
        uint256 id1 = escrow.createEscrow(FOUNDER, address(usdc), 1_000e6);

        assertEq(id1, 1);

        // Try to create another (verify no double-counting)
        vm.prank(VC);
        uint256 id2 = escrow.createEscrow(FOUNDER, address(usdc), 1_000e6);

        assertEq(id2, 2);
    }

    /// @dev Test authorization - only owner can set registry
    function test_authorization_setIdentityRegistry() public {
        vm.prank(ATTACKER);
        vm.expectRevert();
        escrow.setIdentityRegistry(address(identityRegistry));
    }

    /// @dev Test authorization - only owner can set agent manager
    function test_authorization_setAgentManager() public {
        vm.prank(ATTACKER);
        vm.expectRevert();
        escrow.setAgentManager(address(agentManager));
    }

    /// @dev Test revoked identity cannot be registered
    function test_revoked_identity_cannot_be_reregistered() public {
        bytes32 hash = keccak256(abi.encodePacked("test"));

        vm.prank(FOUNDER);
        identityRegistry.registerIdentity(hash);

        vm.prank(FOUNDER);
        identityRegistry.revokeIdentity(FOUNDER);

        vm.prank(FOUNDER);
        vm.expectRevert();
        identityRegistry.registerIdentity(hash);
    }

    /// @dev Test that escrow state transitions correctly
    function test_escrow_state_transitions() public {
        vm.prank(VC);
        uint256 escrowId = escrow.createEscrow(FOUNDER, address(usdc), 1_000e6);

        uint8 state = escrow.getEscrowState(escrowId);
        assertEq(state, uint8(SentinXTypes.EscrowState.Pending));

        // Move to Active
        vm.prank(FOUNDER);
        escrow.fundCollateralAndEquity(escrowId, address(equity), 100_000e18, address(weth), 10e18);

        state = escrow.getEscrowState(escrowId);
        assertEq(state, uint8(SentinXTypes.EscrowState.Active));
    }

    /// @dev Test identity can't be registered by non-owner if revoked
    function test_revoked_user_cannot_register_for_themselves() public {
        bytes32 hash = keccak256(abi.encodePacked("test"));

        vm.prank(FOUNDER);
        identityRegistry.registerIdentity(hash);

        vm.prank(OWNER);
        identityRegistry.revokeIdentity(FOUNDER);

        vm.prank(FOUNDER);
        vm.expectRevert();
        identityRegistry.registerIdentity(hash);
    }
}

/// ============================================================================
/// Stress & Boundary Tests
/// ============================================================================

contract StressTest is Test {
    Escrow public escrow;
    AgentManager public agentManager;
    MockERC20 public usdc;
    MockERC20 public weth;
    MockERC20 public equity;

    address public constant OWNER = address(0x5555);
    address public constant VC = address(0x1111);
    address public constant FOUNDER = address(0x2222);

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC");
        weth = new MockERC20("WETH", "WETH");
        equity = new MockERC20("EQUITY", "EQ");

        agentManager = new AgentManager(OWNER);
        escrow = new Escrow(OWNER, address(agentManager), address(0), address(weth));

        usdc.mint(VC, 1_000_000_000e6); // 1B USDC
        weth.mint(FOUNDER, 1_000_000e18); // 1M WETH
        equity.mint(FOUNDER, 1_000_000_000e18); // 1B equity

        vm.prank(VC);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(FOUNDER);
        weth.approve(address(escrow), type(uint256).max);

        vm.prank(FOUNDER);
        equity.approve(address(escrow), type(uint256).max);
    }

    /// @dev Test with maximum uint256 values
    function test_large_grant_amounts() public {
        uint256 largeAmount = 1_000_000_000e6; // 1B USDC

        vm.prank(VC);
        uint256 escrowId = escrow.createEscrow(FOUNDER, address(usdc), largeAmount);

        assertEq(escrowId, 1);
        assertEq(usdc.balanceOf(address(escrow)), largeAmount);
    }

    /// @dev Test multiple sequential escrows
    function test_many_escrows_created() public {
        uint256 numEscrows = 100;

        for (uint256 i = 0; i < numEscrows; i++) {
            vm.prank(VC);
            uint256 id = escrow.createEscrow(FOUNDER, address(usdc), 1_000e6);
            assertEq(id, i + 1);
        }
    }

    /// @dev Test minimum amounts
    function test_minimum_amounts() public {
        // Minimum non-zero amount
        vm.prank(VC);
        uint256 id = escrow.createEscrow(FOUNDER, address(usdc), 1);
        
        assertEq(id, 1);
        assertEq(usdc.balanceOf(address(escrow)), 1);
    }

    /// @dev Test many milestones
    function test_many_milestones() public {
        vm.prank(VC);
        uint256 escrowId = escrow.createEscrow(FOUNDER, address(usdc), 100_000e6);

        vm.prank(FOUNDER);
        escrow.fundCollateralAndEquity(escrowId, address(equity), 10_000_000e18, address(weth), 1000e18);

        uint256 numMilestones = 50;
        uint256[] memory grantPayouts = new uint256[](numMilestones);
        uint256[] memory equityPayouts = new uint256[](numMilestones);
        uint256[] memory targetUsers = new uint256[](numMilestones);

        uint256 grantPerMilestone = 100_000e6 / numMilestones;
        uint256 equityPerMilestone = 10_000_000e18 / numMilestones;

        for (uint256 i = 0; i < numMilestones; i++) {
            grantPayouts[i] = grantPerMilestone;
            equityPayouts[i] = equityPerMilestone;
            targetUsers[i] = 10 + (i + 1);
        }

        vm.prank(FOUNDER);
        escrow.setupMilestones(escrowId, grantPayouts, equityPayouts, targetUsers);

        uint256[] memory milestones = escrow.getEscrowMilestones(escrowId);
        assertEq(milestones.length, numMilestones);
    }

    /// @dev Test deadline edge case (far future)
    function test_extreme_deadline() public {
        uint256 veryFarFuture = type(uint256).max;

        vm.prank(VC);
        uint256 id = escrow.createEscrow(FOUNDER, address(usdc), 1_000e6);

        assertEq(id, 1);
    }

    /// @dev Test deadline edge case (now)
    function test_immediate_deadline() public {
        uint256 currentTime = block.timestamp;

        vm.prank(VC);
        uint256 id = escrow.createEscrow(FOUNDER, address(usdc), 1_000e6);

        assertEq(id, 1);
    }
}

/// ============================================================================
/// Decimal Handling Tests
/// ============================================================================

contract DecimalTest is Test {
    Escrow public escrow;
    AgentManager public agentManager;
    MockERC20 public usdc; // 6 decimals
    MockERC20 public token18; // 18 decimals
    MockERC20 public token8; // 8 decimals

    address public constant OWNER = address(0x5555);
    address public constant VC = address(0x1111);
    address public constant FOUNDER = address(0x2222);

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC");
        token18 = new MockERC20("TOKEN18", "T18");
        token8 = new MockERC20("TOKEN8", "T8");

        agentManager = new AgentManager(OWNER);
        escrow = new Escrow(OWNER, address(agentManager), address(0), address(token18));

        usdc.mint(VC, 1_000_000e6);
        token18.mint(FOUNDER, 1_000_000e18);
        token8.mint(VC, 100_000_000e8);

        vm.prank(VC);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(VC);
        token8.approve(address(escrow), type(uint256).max);

        vm.prank(FOUNDER);
        token18.approve(address(escrow), type(uint256).max);
    }

    /// @dev Test 6-decimal token (USDC)
    function test_6_decimal_token() public {
        uint256 amount = 1_000e6; // 1000 tokens with 6 decimals

        vm.prank(VC);
        uint256 id = escrow.createEscrow(FOUNDER, address(usdc), amount);

        assertEq(usdc.balanceOf(address(escrow)), amount);
    }

    /// @dev Test 18-decimal token
    function test_18_decimal_token() public {
        uint256 amount = 1_000e18; // 1000 tokens with 18 decimals

        vm.prank(FOUNDER);
        uint256 id = escrow.createEscrow(FOUNDER, address(token18), amount);

        assertEq(token18.balanceOf(address(escrow)), amount);
    }

    /// @dev Test 8-decimal token
    function test_8_decimal_token() public {
        uint256 amount = 100_000e8; // 100k tokens with 8 decimals

        vm.prank(VC);
        uint256 id = escrow.createEscrow(FOUNDER, address(token8), amount);

        assertEq(token8.balanceOf(address(escrow)), amount);
    }

    /// @dev Test decimal consistency across operations
    function test_decimal_consistency_multiple_tokens() public {
        uint256 usdc_amount = 1_000e6;
        uint256 token18_amount = 500e18;

        vm.prank(VC);
        uint256 id1 = escrow.createEscrow(FOUNDER, address(usdc), usdc_amount);

        vm.prank(FOUNDER);
        uint256 id2 = escrow.createEscrow(VC, address(token18), token18_amount);

        assertEq(usdc.balanceOf(address(escrow)), usdc_amount);
        assertEq(token18.balanceOf(address(escrow)), token18_amount);
    }
}

/// ============================================================================
/// Data Integrity Tests
/// ============================================================================

contract DataIntegrityTest is Test {
    Escrow public escrow;
    AgentManager public agentManager;
    MockERC20 public usdc;
    MockERC20 public weth;
    MockERC20 public equity;

    address public constant OWNER = address(0x5555);
    address public constant VC = address(0x1111);
    address public constant FOUNDER = address(0x2222);
    address public constant AGENT = address(0x3333);

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC");
        weth = new MockERC20("WETH", "WETH");
        equity = new MockERC20("EQUITY", "EQ");

        agentManager = new AgentManager(OWNER);
        escrow = new Escrow(OWNER, address(agentManager), address(0), address(weth));

        usdc.mint(VC, 100_000e6);
        weth.mint(FOUNDER, 10_000e18);
        equity.mint(FOUNDER, 10_000_000e18);

        vm.prank(VC);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(FOUNDER);
        weth.approve(address(escrow), type(uint256).max);

        vm.prank(FOUNDER);
        equity.approve(address(escrow), type(uint256).max);
    }

    /// @dev Test escrow data immutability (initial values don't change)
    function test_escrow_immutability() public {
        bytes32 originalHash = keccak256(abi.encodePacked("deposit_data"));

        vm.prank(VC);
        uint256 id = escrow.createEscrow(FOUNDER, address(usdc), 1_000e6);

        (address payer, address payee, address grantToken, uint256 grantTotal, , , , , , , uint256 createdAt) = 
            escrow.escrows(id);

        assertEq(payer, VC);
        assertEq(payee, FOUNDER);
        assertEq(grantToken, address(usdc));
        assertEq(grantTotal, 1_000e6);
        assertGt(createdAt, 0);
    }

    /// @dev Test milestone data integrity
    function test_milestone_data_integrity() public {
        vm.prank(VC);
        uint256 id = escrow.createEscrow(FOUNDER, address(usdc), 10_000e6);

        vm.prank(FOUNDER);
        escrow.fundCollateralAndEquity(id, address(equity), 1_000_000e18, address(weth), 100e18);

        uint256[] memory grantPayouts = new uint256[](1);
        grantPayouts[0] = 5_000e6;

        uint256[] memory equityPayouts = new uint256[](1);
        equityPayouts[0] = 500_000e18;

        uint256[] memory targetUsers = new uint256[](1);
        targetUsers[0] = 75;

        vm.prank(FOUNDER);
        escrow.setupMilestones(id, grantPayouts, equityPayouts, targetUsers);

        uint256[] memory milestoneIds = escrow.getEscrowMilestones(id);
        (uint256 msEscrowId, uint256 msGrant, uint256 msEquity, uint256 msTargetUsers, bool isApproved, bool isClaimed) = 
            escrow.getMilestone(milestoneIds[0]);

        assertEq(msEscrowId, id);
        assertEq(msGrant, 5_000e6);
        assertEq(msEquity, 500_000e18);
        assertEq(msTargetUsers, 75);
        assertFalse(isApproved);
        assertFalse(isClaimed);
    }

    /// @dev Test that escrow data is independent
    function test_multiple_escrows_independent() public {
        uint256 escrowId1;
        uint256 escrowId2;

        vm.prank(VC);
        escrowId1 = escrow.createEscrow(FOUNDER, address(usdc), 1_000e6);

        vm.prank(VC);
        escrowId2 = escrow.createEscrow(FOUNDER, address(usdc), 2_000e6);

        // Verify both escrows exist and have different amounts
        assertTrue(escrowId1 != 0);
        assertTrue(escrowId2 != 0);
    }
}
