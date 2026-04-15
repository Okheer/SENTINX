// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import {Escrow} from "../src/Escrow.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AgentManager} from "../src/AgentManager.sol";
import {MilestoneManager} from "../src/MilestoneManager.sol";
import {YieldManager} from "../src/YieldManager.sol";
import {MockYieldRouter} from "../src/MockYieldRouter.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/// ============================================================================
/// Mock Token Contracts (for testing/demo)
/// ============================================================================

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return 6;
    }
}

contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }
}

/// ============================================================================
/// Deployment Script
/// ============================================================================

contract DeployScript is Script {
    // Deployment config
    struct DeploymentConfig {
        address owner;
        address rpc;
        bool deployMockTokens;
        string usdcAddress;
        string wethAddress;
    }

    // Deployed contract addresses
    struct DeployedContracts {
        address agentManager;
        address mockRouter;
        address yieldManager;
        address escrow;
        address identityRegistry;
        address milestoneManager;
        address mockUsdc;
        address mockWeth;
    }

    DeploymentConfig config;
    DeployedContracts deployed;

    function run() public {
        // Load configuration
        config = loadConfig();

        console.log("======= SENTIX Contract Deployment v1.0 =======");
        console.log("");
        console.log("Configuration:");
        console.log("---------------------------------------");
        console.log("Owner:", config.owner);
        console.log("Deploy Mock Tokens:", config.deployMockTokens);
        console.log("");

        vm.startBroadcast();

        // Step 1: Deploy or use existing tokens
        deployTokens();

        // Step 2: Deploy core contracts
        deployCore();

        // Step 3: Setup relationships
        setupRelationships();

        // Step 4: Fund test accounts (optional)
        fundTestAccounts();

        vm.stopBroadcast();

        // Output
        printResults();
    }

    /// ─────────────── Load Configuration ───────────────

    function loadConfig() internal view returns (DeploymentConfig memory) {
        address owner = vm.envOr("DEPLOYMENT_OWNER", msg.sender);
        bool deployMocks = vm.envOr("DEPLOY_MOCKS", true);

        return DeploymentConfig({
            owner: owner,
            rpc: address(0),
            deployMockTokens: deployMocks,
            usdcAddress: "",
            wethAddress: ""
        });
    }

    /// Deploy Tokens

    function deployTokens() internal {
        console.log("Step 1: Deploying Tokens");
        console.log("- - - - - - - - - - - - -");

        if (config.deployMockTokens) {
            console.log("Deploying mock USDC...");
            MockUSDC usdc = new MockUSDC();
            deployed.mockUsdc = address(usdc);
            console.log("  MockUSDC deployed:", address(usdc));

            console.log("Deploying mock WETH...");
            MockWETH weth = new MockWETH();
            deployed.mockWeth = address(weth);
            console.log("  MockWETH deployed:", address(weth));

            // Fund the deployer
            usdc.mint(msg.sender, 1_000_000e6);
            weth.mint(msg.sender, 1_000e18);
            console.log("  Minted tokens to deployer");
        } else {
            console.log("Using existing tokens from env...");
            // In production, load from environment
        }

        console.log("");
    }

    /// Deploy Core Contracts

    function deployCore() internal {
        console.log("Step 2: Deploying Core Contracts");
        console.log("- - - - - - - - - - - - - - - - -");

        // 1. AgentManager
        console.log("Deploying AgentManager...");
        AgentManager agentManager = new AgentManager(config.owner);
        deployed.agentManager = address(agentManager);
        console.log("   AgentManager deployed:", address(agentManager));

        // 2. MockYieldRouter
        console.log("Deploying MockYieldRouter...");
        MockYieldRouter mockRouter = new MockYieldRouter();
        deployed.mockRouter = address(mockRouter);
        console.log("  MockYieldRouter deployed:", address(mockRouter));

        // 3. YieldManager
        console.log("Deploying YieldManager...");
        YieldManager yieldManager = new YieldManager(address(mockRouter), deployed.mockWeth);
        deployed.yieldManager = address(yieldManager);
        console.log("  YieldManager deployed:", address(yieldManager));

        // 4. Escrow
        console.log("Deploying Escrow...");
        Escrow escrow = new Escrow(
            config.owner,
            address(agentManager),
            address(mockRouter),
            deployed.mockWeth
        );
        deployed.escrow = address(escrow);
        deployed.milestoneManager = address(escrow.milestoneManager());
        console.log("  Escrow deployed:", address(escrow));
        console.log("  MilestoneManager deployed:", deployed.milestoneManager);

        // 5. IdentityRegistry
        console.log("Deploying IdentityRegistry...");
        IdentityRegistry identityRegistry = new IdentityRegistry(config.owner);
        deployed.identityRegistry = address(identityRegistry);
        console.log("  IdentityRegistry deployed:", address(identityRegistry));

        console.log("");
    }

    /// Setup Relationships

    function setupRelationships() internal {
        console.log("Step 3: Setting Up Relationships");
        console.log("- - - - - - - - - - - - - - - - -");

        // Escrow → IdentityRegistry
        (bool success, ) = deployed.escrow.call(
            abi.encodeWithSignature("setIdentityRegistry(address)", deployed.identityRegistry)
        );
        require(success, "setIdentityRegistry failed");
        console.log(" Escrow.setIdentityRegistry:", deployed.identityRegistry);

        // IdentityRegistry → AgentManager
        (success, ) = deployed.identityRegistry.call(
            abi.encodeWithSignature("setAgentManager(address)", deployed.agentManager)
        );
        require(success, "setAgentManager failed");
        console.log("  IdentityRegistry.setAgentManager:", deployed.agentManager);

        console.log("");
    }

    /// Fund Test Accounts

    function fundTestAccounts() internal {
        console.log("Step 4: Funding Test Accounts");
        console.log("- - - - - - - - - - - - - - -");

        MockUSDC usdc = MockUSDC(deployed.mockUsdc);
        MockWETH weth = MockWETH(deployed.mockWeth);

        address[] memory testAddresses = new address[](4);
        testAddresses[0] = vm.envOr("TEST_VC", address(0x1111111111111111111111111111111111111111));
        testAddresses[1] = vm.envOr("TEST_FOUNDER", address(0x2222222222222222222222222222222222222222));
        testAddresses[2] = vm.envOr("TEST_AGENT", address(0x3333333333333333333333333333333333333333));
        testAddresses[3] = vm.envOr("TEST_SENTRY", address(0x4444444444444444444444444444444444444444));

        for (uint i = 0; i < testAddresses.length; i++) {
            if (testAddresses[i] != address(0)) {
                usdc.mint(testAddresses[i], 100_000e6);
                weth.mint(testAddresses[i], 100e18);
                console.log("  Funded", testAddresses[i]);
            }
        }

        console.log("");
    }

    /// Print Results

    function printResults() internal view {
        console.log("===== Deployment Complete! =====");
        console.log("");
        console.log("Contract Addresses:");
        console.log("- - - - - - - - - - - - - - - -");
        console.log("");
        console.log("Core Contracts:");
        console.log("  AgentManager:      ", deployed.agentManager);
        console.log("  IdentityRegistry:  ", deployed.identityRegistry);
        console.log("  Escrow:            ", deployed.escrow);
        console.log("  MilestoneManager:  ", deployed.milestoneManager);
        console.log("  YieldManager:      ", deployed.yieldManager);
        console.log("  MockYieldRouter:   ", deployed.mockRouter);
        console.log("");
        console.log("Mock Tokens:");
        console.log("  MockUSDC:          ", deployed.mockUsdc);
        console.log("  MockWETH:          ", deployed.mockWeth);
        console.log("");
        console.log("Next Steps:");
        console.log("- - - - - -");
        console.log("1. Register agents with AgentManager");
        console.log("2. Fund escrow with grant tokens");
        console.log("3. Create milestones and manage payouts");
        console.log("4. Run tests with: forge test");
        console.log("");
        console.log("Environment Variables:");
        console.log("- - - - - - - - - - - - - - -");
        console.log("export ESCROW_ADDRESS=", deployed.escrow);
        console.log("export IDENTITY_REGISTRY_ADDRESS=", deployed.identityRegistry);
        console.log("export AGENT_MANAGER_ADDRESS=", deployed.agentManager);
        console.log("export MOCK_ROUTER_ADDRESS=", deployed.mockRouter);
        console.log("export USDC_ADDRESS=", deployed.mockUsdc);
        console.log("export WETH_ADDRESS=", deployed.mockWeth);
        console.log("");
    }
}

/// ============================================================================
/// Testing Helper Script
/// ============================================================================

contract TestHelperScript is Script {
    function run() public {
        // Example: register agent
        console.log("Testing helper script - customize as needed for your workflow");

        address agentManager = vm.envAddress("AGENT_MANAGER_ADDRESS");
        address agent = vm.envOr("TEST_AGENT", address(0xAAAA));
        address owner = vm.envAddress("DEPLOYMENT_OWNER");

        vm.startBroadcast(owner);

        // Register agent (example)
        // AgentManager(agentManager).registerAgent(agent);
        // console.log("Registered agent:", agent);

        vm.stopBroadcast();
    }
}
