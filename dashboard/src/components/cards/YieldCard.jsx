import React from 'react';
import '../../styles/Cards.css';

export default function YieldCard({ data }) {
    return (
        <div className="card yield-card">
            <h2 className="card-title">Yield Deployment</h2>
            <div className="yield-breakdown">
                <div className="yield-flow">
                    <div className="yield-step">
                        <div className="yield-icon">💵</div>
                        <div className="yield-label">USDC In</div>
                        <div className="yield-amount">${parseFloat(data.deployed_usdc).toFixed(2)}</div>
                    </div>
                    <div className="yield-arrow">→</div>
                    <div className="yield-step">
                        <div className="yield-icon">🔄</div>
                        <div className="yield-label">Uniswap V3</div>
                        <div className="yield-amount">Swap</div>
                    </div>
                    <div className="yield-arrow">→</div>
                    <div className="yield-step">
                        <div className="yield-icon">🎁</div>
                        <div className="yield-label">OKB Out</div>
                        <div className="yield-amount">${data.yield_earned_usd}</div>
                    </div>
                </div>
                <div className="yield-stats">
                    <div className="yield-stat">
                        <span className="stat-label">Deployed:</span>
                        <span className="stat-value">{data.deployed_usdc} USDC</span>
                    </div>
                    <div className="yield-stat">
                        <span className="stat-label">APY Simulation:</span>
                        <span className="stat-value">12.5%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
