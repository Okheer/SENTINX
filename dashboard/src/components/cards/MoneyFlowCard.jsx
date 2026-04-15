import React from 'react';
import '../../styles/Cards.css';

export default function MoneyFlowCard({ data }) {
    // Determine states dynamically for visual feedback during the demo
    const isFunded = Number(data?.deployed_usdc || 0) > 0;
    const hasYield = Number(data?.yield_earned_usd || 0) > 0;

    const flowEvents = [
        {
            icon: isFunded ? '✅' : '📥',
            title: 'VC Deposit',
            amount: isFunded ? `$${data.deployed_usdc} USDC` : '$0 USDC',
            time: isFunded ? 'Escrow locked' : 'Awaiting deposit...',
            active: isFunded
        },
        {
            icon: '🔒',
            title: 'Founder Collateral',
            amount: '1.0 OKB posted',
            // Emphasize the lock constraint for the first two milestones
            time: 'Locked for Milestones 1 & 2', 
            active: true // Always active as it represents pre-posted security
        },
        {
            icon: isFunded ? '⚙️' : '⏳',
            title: 'Yield Deployment',
            amount: isFunded ? `$${data.deployed_usdc} → OKB` : '$0 → OKB',
            time: 'Mock Uniswap V2',
            active: isFunded
        },
        {
            icon: hasYield ? '💸' : '💤',
            title: 'LP Fees',
            amount: `+$${data?.yield_earned_usd || '0.00'}`,
            time: hasYield ? 'Continuous Generating' : 'Pending Deployment',
            active: hasYield
        },
    ];

    return (
        <div className="card money-flow-card">
            <h2 className="card-title">Capital Movement</h2>
            <div className="money-flow-timeline">
                {flowEvents.map((event, i) => (
                    <div 
                        key={i} 
                        className="flow-event" 
                        style={{ 
                            opacity: event.active ? 1 : 0.4, 
                            transition: 'opacity 0.4s ease-in-out',
                            marginBottom: '15px'
                        }}
                    >
                        <div className="flow-icon" style={{ filter: event.active ? 'none' : 'grayscale(100%)' }}>
                            {event.icon}
                        </div>
                        <div className="flow-content">
                            <div className="flow-title" style={{ color: event.active ? '#fff' : '#9ca3af' }}>
                                {event.title}
                            </div>
                            <div className="flow-amount" style={{ color: event.active ? '#10b981' : '#6b7280', fontWeight: 'bold' }}>
                                {event.amount}
                            </div>
                            <div className="flow-time" style={{ color: '#8b5cf6', fontSize: '0.8rem' }}>
                                {event.time}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Smart Contract Structure Note for the Demo */}
            <div style={{ 
                marginTop: '20px', 
                padding: '12px', 
                background: 'rgba(59, 130, 246, 0.1)', 
                border: '1px solid #3b82f6', 
                borderRadius: '8px', 
                fontSize: '0.85rem', 
                color: '#93c5fd' 
            }}>
                <strong>⛓️ Contract Logic:</strong> The Autonomous Agent enforces the Escrow. The Founder's 1.0 OKB equity/collateral cannot be withdrawn until the user targets for Milestones 1 and 2 are cryptographically verified.
            </div>
        </div>
    );
}