import React from 'react';
import '../../styles/Cards.css';

export default function PhaseCard({ data }) {
    const phases = [
        {
            icon: '○',
            name: 'PENDING',
            desc: 'Awaiting first submission',
            state: data.deal_state === 'WAITING_FOR_CONTRACTS' ? 'active' : 'complete',
        },
        {
            icon: '◐',
            name: 'ACTIVE',
            desc: 'Processing addresses & yielding',
            state: data.deal_state === 'ACTIVE' || data.deal_state === 'MILESTONE_PENDING_RELEASE' ? 'active' : data.deal_state === 'MILESTONE_COMPLETE' ? 'complete' : 'pending',
        },
        {
            icon: '◉',
            name: 'COMPLETE',
            desc: 'Threshold reached, released',
            state: data.deal_state === 'MILESTONE_COMPLETE' ? 'complete' : 'pending',
        },
    ];

    return (
        <div className="card phase-card">
            <h2 className="card-title">Phase State Machine</h2>
            <div className="phase-list">
                {phases.map((phase, i) => (
                    <div key={i} className={`phase-item ${phase.state}`}>
                        <div className="phase-icon">{phase.icon}</div>
                        <div className="phase-info">
                            <div className="phase-name">{phase.name}</div>
                            <div className="phase-desc">{phase.desc}</div>
                        </div>
                        <div className="phase-status">
                            {phase.state === 'active' ? '●' : phase.state === 'complete' ? '✓' : '—'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
