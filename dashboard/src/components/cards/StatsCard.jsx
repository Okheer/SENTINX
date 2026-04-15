import React, { useState, useEffect } from 'react';
import '../../styles/Cards.css';

export default function StatsCard({ data }) {
    const [lastUpdated, setLastUpdated] = useState(
        new Date().toLocaleTimeString()
    );

    useEffect(() => {
        setLastUpdated(new Date().toLocaleTimeString());
    }, [data]);

    return (
        <div className="card stats-card">
            <h2 className="card-title">Agent Status</h2>
            <div className="stats-list">
                <div className="stat-row">
                    <span className="stat-key">Cycle Count:</span>
                    <span className="stat-val">{data.cycle_count}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-key">Loop Interval:</span>
                    <span className="stat-val">30s</span>
                </div>
                <div className="stat-row">
                    <span className="stat-key">Deal State:</span>
                    <span className="stat-val">{data.deal_state}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-key">Last Updated:</span>
                    <span className="stat-val">{lastUpdated}</span>
                </div>
            </div>
        </div>
    );
}
