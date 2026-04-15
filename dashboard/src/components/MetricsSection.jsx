import React from 'react';
import '../styles/Metrics.css';

export default function MetricsSection({ data }) {
    const metrics = [
        {
            icon: '💰',
            label: 'Grant Locked',
            value: '$50,000',
            unit: 'USDC',
        },
        {
            icon: '✅',
            label: 'Verified Users',
            value: data.verified_count,
            unit: `/ ${data.threshold} target`,
        },
        {
            icon: '📈',
            label: 'Yield Earned',
            value: `$${data.yield_earned_usd}`,
            unit: 'from OKB swap',
        },
        {
            icon: '🤖',
            label: 'Bots Rejected',
            value: data.bots_rejected,
            unit: 'diversity fails',
        },
    ];

    return (
        <section className="metrics-section">
            {metrics.map((metric, i) => (
                <div key={i} className="metric-card">
                    <div className="metric-icon">{metric.icon}</div>
                    <div className="metric-content">
                        <div className="metric-label">{metric.label}</div>
                        <div className="metric-value">{metric.value}</div>
                        <div className="metric-unit">{metric.unit}</div>
                    </div>
                </div>
            ))}
        </section>
    );
}
