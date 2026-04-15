import React from 'react';
import '../../styles/Cards.css';

export default function MoneyFlowCard({ data }) {
    const flowEvents = [
        {
            icon: '📥',
            title: 'VC Deposit',
            amount: '$50,000 USDC',
            time: 'Escrow locked',
        },
        {
            icon: '🔒',
            title: 'Founder Collateral',
            amount: '1.0 OKB posted',
            time: 'Deal security',
        },
        {
            icon: '⚙️',
            title: 'Yield Deployment',
            amount: `$${data.deployed_usdc} → OKB`,
            time: 'Uniswap V3',
        },
        {
            icon: '💸',
            title: 'LP Fees',
            amount: `+$${data.yield_earned_usd}`,
            time: 'Continuous',
        },
    ];

    return (
        <div className="card money-flow-card">
            <h2 className="card-title">Capital Movement</h2>
            <div className="money-flow-timeline">
                {flowEvents.map((event, i) => (
                    <div key={i} className="flow-event">
                        <div className="flow-icon">{event.icon}</div>
                        <div className="flow-content">
                            <div className="flow-title">{event.title}</div>
                            <div className="flow-amount">{event.amount}</div>
                            <div className="flow-time">{event.time}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
