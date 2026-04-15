import React, { useEffect, useState } from 'react';
import '../styles/SlashingBanner.css';

export default function SlashingBanner() {
    const [daysRemaining, setDaysRemaining] = useState(30);

    useEffect(() => {
        // Calculate days remaining until May 15, 2026
        const deadline = new Date('2026-05-15');
        const today = new Date('2026-04-15');
        const diff = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
        setDaysRemaining(Math.max(0, diff));
    }, []);

    const progressPercent = (daysRemaining / 30) * 100;

    return (
        <section className="slashing-banner">
            <div className="banner-content">
                <div className="banner-icon">⚡</div>
                <div className="banner-text">
                    <h3>Milestone Deadline (Slash Protection)</h3>
                    <p>Agent monitors countdown and auto-fires slash() if deadline passes</p>
                </div>
                <div className="countdown-timer">
                    <div className="countdown-days">
                        <span className="countdown-value">{daysRemaining}</span>
                        <span className="countdown-label">days</span>
                    </div>
                    <div className="countdown-progress-bar">
                        <div
                            className="countdown-progress"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                    <p className="countdown-info">Due: May 15, 2026</p>
                </div>
            </div>
        </section>
    );
}
