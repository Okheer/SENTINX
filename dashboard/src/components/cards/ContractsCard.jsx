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
            label: 'Sentry',
            address: data.sentry_wallet || '0x...',
        },
    ];

    return (
        <div className="card contracts-card">
            <h2 className="card-title">On-Chain Contracts</h2>
            <div className="contracts-list">
                {contracts.map((contract, i) => (
                    <div key={i} className="contract-item">
                        <div className="contract-label">{contract.label}</div>
                        <div className="contract-address">{contract.address}</div>
                        <button
                            className="copy-btn"
                            onClick={() => copyToClipboard(contract.address)}
                        >
                            📋
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
