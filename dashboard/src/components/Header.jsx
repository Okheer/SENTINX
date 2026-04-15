import React from 'react';
import '../styles/Header.css';

export default function Header() {
    return (
        <header className="header">
            <div className="header-content">
                <div className="logo-section">
                    <h1 className="logo">🔐 SENTINX</h1>
                    <p className="tagline">Autonomous Sentry Agent • Real-time Monitoring</p>
                </div>
                <div className="status-indicator">
                    <div className="status-dot live"></div>
                    <span className="status-text">LIVE</span>
                </div>
            </div>
        </header>
    );
}
