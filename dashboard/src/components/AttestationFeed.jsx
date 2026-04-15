import React from 'react';
import '../styles/AttestationFeed.css';

export default function AttestationFeed({ feed }) {
    return (
        <div className="card attestation-card">
            <h2 className="card-title">Live Attestation Feed</h2>
            <div className="feed-container">
                {feed.map((item, i) => (
                    <div key={i} className={`feed-item ${item.type}`}>
                        <span className="feed-time">{item.time}</span>
                        <span className={`feed-badge ${item.type}`}>{item.badge}</span>
                        <span className="feed-msg">{item.msg}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
