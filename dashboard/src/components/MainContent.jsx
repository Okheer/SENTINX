import React, { useState, useEffect, useRef } from 'react';
import '../styles/MainContent.css';
import MilestoneCard from './cards/MilestoneCard';
import PhaseCard from './cards/PhaseCard';
import YieldCard from './cards/YieldCard';
import MoneyFlowCard from './cards/MoneyFlowCard';
import ContractsCard from './cards/ContractsCard';
import StatsCard from './cards/StatsCard';
import { ethers } from 'ethers';

export default function MainContent({ data, copyToClipboard }) {
    // --- State Management ---
    const [activeRole, setActiveRole] = useState('VC'); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [logs, setLogs] = useState([]);
    const scrollRef = useRef(null);
    
    // 🚨 OPTIMISTIC UI STATE
    // This forces the UI to show 2 verified users the moment the button is clicked
    const [optimisticVerified, setOptimisticVerified] = useState(false);

    // Form States
    const [vcAmount, setVcAmount] = useState(50);
    const [addr1, setAddr1] = useState('0x94f94a111cBBd5e33ec440A199542955a307bB8e');
    const [addr2, setAddr2] = useState('0x7338FA942f343A305fE42c357E8Ae671eF1358e1');

    // --- Derived Data for UI ---
    // This object uses the real data unless we've clicked the "Submit" button
    const displayData = {
        ...data,
        humans_verified: optimisticVerified ? 2 : (data?.humans_verified || 0),
        verified_count: optimisticVerified ? 2 : (data?.verified_count || 0),
        // Force the phase to "ACTIVE" or "VERIFIED" if needed for the UI
        deal_state: optimisticVerified ? 'ACTIVE' : (data?.deal_state || 'IDLE')
    };

    // --- 1. Terminal Polling Logic ---
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch('http://localhost:3001/api/logs');
                const logData = await res.json();
                setLogs(logData);
            } catch (err) { console.error("Log fetch failed", err); }
        };

        const interval = setInterval(fetchLogs, 2000); 
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const handleShowSwapJSON = async () => {
        try {
            await fetch('http://localhost:3001/api/show-swap-json');
        } catch (err) {
            console.error("Failed to trigger swap JSON dump", err);
        }
    };

    // --- 2. Web3 Logic Functions ---
    const handleMintFakeUSDC = async () => {
        try {
            if (!window.ethereum) throw new Error("Please install OKX Wallet.");
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const userAddress = await signer.getAddress();

            const MOCK_USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; 
            const abi = ["function mint(address to, uint256 amount) public"];
            const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, abi, signer);

            const amountToMint = ethers.parseUnits("100000", 6);
            const tx = await usdcContract.mint(userAddress, amountToMint);
            await tx.wait();
            alert(`Success! Minted 100k Mock USDC to ${userAddress}`);
        } catch (err) {
            console.error("Minting failed:", err);
            alert("Failed to mint.");
        }
    };

    const handleVCDeposit = async () => {
        try {
            if (!window.ethereum) throw new Error("No wallet found.");
            const provider = new ethers.BrowserProvider(window.ethereum);
            const XLAYER_TESTNET_CHAIN_ID = '0x7a0'; 
            
            const signer = await provider.getSigner();
            const MOCK_USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
            const ESCROW_ADDRESS = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
            
            const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, ["function approve(address spender, uint256 amount) public returns (bool)"], signer);
            const escrowContract = new ethers.Contract(ESCROW_ADDRESS, ["function deposit(uint256 amount) public"], signer);

            const parsedAmount = ethers.parseUnits(vcAmount.toString(), 6);
            const approveTx = await usdcContract.approve(ESCROW_ADDRESS, parsedAmount);
            await approveTx.wait();

            const depositTx = await escrowContract.deposit(parsedAmount);
            await depositTx.wait();

            alert("VC Deposit Successful!");
            await fetch('http://localhost:3001/api/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: Number(vcAmount) })
            });

        } catch (err) {
            console.error(err);
            alert("Transaction failed.");
        }
    };

    const handleFounderSubmit = async () => {
        if (!addr1 || !addr2) return alert("Please provide two addresses");
        
        // 🚀 INSTANT UI JUMP
        setIsSubmitting(true);
        setOptimisticVerified(true); 

        try {
            await fetch('http://localhost:3001/api/submit-milestone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addresses: [addr1, addr2] })
            });
        } catch (err) {
            console.error("Failed to submit", err);
            // Optionally: setOptimisticVerified(false) if you want to revert on error
        } finally {
            // Keep the loading state for 2 seconds for "processing" feel
            setTimeout(() => setIsSubmitting(false), 2000);
        }
    };

    const handleYieldDeployment = async () => {
        try {
            if (!window.ethereum) throw new Error("No wallet found.");
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            const MOCK_USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
            const MOCK_YIELD_ADDRESS = "0xF8AF45980361c69C7517E2A2Ae76cfBA78B98e60"; 
            const amountInWei = ethers.parseUnits("50", 6);

            console.log("Approving YieldManager...");
            const erc20Abi = ["function approve(address spender, uint256 amount) public returns (bool)"];
            const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, erc20Abi, signer);
            
            const approveTx = await usdcContract.approve(MOCK_YIELD_ADDRESS, amountInWei);
            await approveTx.wait();

            const yieldAbi = ["function deposit(uint256 amount) public"];
            const mockYieldContract = new ethers.Contract(MOCK_YIELD_ADDRESS, yieldAbi, signer);

            console.log("Sending yield transaction...");
            const tx = await mockYieldContract.deposit(amountInWei); 
            const txHash = tx.hash;

            await fetch('http://localhost:3001/api/log-tx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash: txHash, message: "Yield deployed to OKX DEX" })
            });

            await tx.wait();
        } catch (error) {
            console.error("Transaction failed:", error);
        }
    };

    return (
        <section className="content-section">
            
            {/* --- DEMO CONTROL PANEL --- */}
            <div className="card demo-panel" style={{ gridColumn: "1 / -1", marginBottom: "20px", padding: "20px", background: "#111827", border: "1px solid #374151", borderRadius: "12px" }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #374151', paddingBottom: '10px' }}>
                    <button onClick={() => setActiveRole('VC')} style={{ padding: '8px 16px', background: activeRole === 'VC' ? '#3b82f6' : 'transparent', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>👔 VC Dashboard</button>
                    <button onClick={() => setActiveRole('FOUNDER')} style={{ padding: '8px 16px', background: activeRole === 'FOUNDER' ? '#10b981' : 'transparent', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🚀 Founder Dashboard</button>
                </div>
            
                {activeRole === 'VC' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', marginBottom: '5px' }}>USDC Amount</label>
                            <input type="number" value={vcAmount} onChange={(e) => setVcAmount(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#1f2937', color: 'white' }} />
                        </div>
                        <button onClick={handleVCDeposit} style={{ marginTop: '20px', padding: "10px 20px", background: "#3b82f6", borderRadius: "6px", border: "none", color: "white", cursor: "pointer", fontWeight: 'bold' }}>Inject Capital to Escrow</button>
                    </div>
                )}

                {activeRole === 'FOUNDER' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', marginBottom: '5px' }}>Milestone Wallet 1</label>
                                <input type="text" value={addr1} onChange={(e) => setAddr1(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#1f2937', color: 'white', fontFamily: 'monospace' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', marginBottom: '5px' }}>Milestone Wallet 2</label>
                                <input type="text" value={addr2} onChange={(e) => setAddr2(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#1f2937', color: 'white', fontFamily: 'monospace' }} />
                            </div>
                        </div>
                        <button onClick={handleFounderSubmit} disabled={isSubmitting} style={{ alignSelf: 'flex-start', padding: "10px 24px", background: "#10b981", borderRadius: "6px", border: "none", color: "white", cursor: "pointer", fontWeight: 'bold' }}>{isSubmitting ? "⌛ Agent Verifying..." : "Submit Wallets & Unlock Milestone"}</button>
                    </div>
                )}
            </div>

            {/* --- DASHBOARD CARDS: Using displayData for Optimistic UI --- */}
            <div className="left-column">
                <MilestoneCard data={displayData} />
                <PhaseCard data={displayData} />
                <YieldCard data={displayData} />
            </div>
            
            <div className="right-column">
                <MoneyFlowCard data={displayData} />
                <ContractsCard data={displayData} copyToClipboard={copyToClipboard} />
                <StatsCard data={displayData} />
            </div>

            {/* --- WEB TERMINAL UI --- */}
            <div style={{ gridColumn: "1 / -1", marginTop: '30px', background: '#0a0a0a', borderRadius: '12px', padding: '20px', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00ff41', boxShadow: '0 0 8px #00ff41' }}></div>
                        <h3 style={{ color: '#00ff41', margin: 0, fontFamily: 'monospace', fontSize: '14px', letterSpacing: '1px' }}>SENTINX_SENTRY_NODE_v1.0</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handleShowSwapJSON} style={{ background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', padding: '5px 12px', cursor: 'pointer', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>📂 VIEW OKX_SWAP_JSON</button>
                        <button onClick={handleYieldDeployment} style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '5px 12px', cursor: 'pointer', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>🚀 EXECUTE YIELD TX</button>
                    </div>
                </div>
                
                <div ref={scrollRef} style={{ height: '220px', overflowY: 'auto', fontFamily: '"Courier New", monospace', fontSize: '12px', lineHeight: '1.6', color: '#ddd', background: '#050505', padding: '15px', borderRadius: '8px' }}>
                    {logs.length === 0 && <div style={{ color: '#444' }}>Initializing agent stream...</div>}
                    {logs.map((log, i) => (
                        <div key={i} style={{ marginBottom: '4px', borderLeft: `2px solid ${log.type === 'error' ? '#ff4d4d' : log.type === 'success' ? '#00ff41' : '#333'}`, paddingLeft: '10px' }}>
                            <span style={{ color: '#555', marginRight: '10px' }}>[{log.time}]</span>
                            <span style={{ color: log.type === 'error' ? '#ff4d4d' : log.type === 'success' ? '#00ff41' : '#ccc', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{log.msg}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
                <button onClick={handleMintFakeUSDC} style={{ background: '#10b981', color: 'white', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>🖨️ Mint Fake USDC</button>
            </div>
        </section>
    );
}