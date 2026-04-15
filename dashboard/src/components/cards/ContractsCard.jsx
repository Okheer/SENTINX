import React from 'react';
import '../../styles/Cards.css';

export default function ContractsCard({ data, copyToClipboard }) {
    const contracts = [
        {
            label: 'Registry',
            address: '0x1234567890123456789012345678901234567890',
        },
        {
            label: 'Escrow',
            address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        },
        {
            label: 'Sentry (TEE)',
            address: data?.sentry_wallet || '0x00223b332561f6eb2d640adea92c1fc891944f5f0',
        },
        {
            label: 'Mock USDC',
            address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        },
        {
            label: 'Yield Router',
            address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        }
    ];

    return (
        <div className="card contracts-card">
            <h2 className="card-title">On-Chain Contracts</h2>
            <div className="contracts-list">
                {contracts.map((contract, i) => (
                    <div key={i} className="contract-item" style={{ marginBottom: '10px' }}>
                        <div className="contract-label" style={{ color: '#8b5cf6', fontSize: '0.85rem' }}>{contract.label}</div>
                        <div className="contract-address" style={{ fontFamily: 'monospace', color: '#9ca3af', fontSize: '0.8rem', wordBreak: 'break-all' }}>{contract.address}</div>
                        <button
                            className="copy-btn"
                            onClick={() => copyToClipboard && copyToClipboard(contract.address)}
                        >
                            📋
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}