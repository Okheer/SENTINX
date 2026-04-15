import React, { useEffect, useState } from 'react';
import '../../styles/Cards.css';

export default function MilestoneCard({ data }) {
    const [strokeDashoffset, setStrokeDashoffset] = useState(282.7);

    useEffect(() => {
        const progress = data.verified_count / data.threshold;
        const circumference = 282.7;
        const offset = circumference - progress * circumference;
        setStrokeDashoffset(offset);
    }, [data.verified_count, data.threshold]);

    const progressPercent = Math.round((data.verified_count / data.threshold) * 100);

    return (
        <div className="card milestone-card">
            <h2 className="card-title">Milestone Progress</h2>
            <div className="milestone-content">
                <div className="progress-visual">
                    <svg viewBox="0 0 100 100" className="progress-circle">
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#0ea5e9" />
                            </linearGradient>
                        </defs>
                        <circle cx="50" cy="50" r="45" className="progress-circle-bg"></circle>
                        <circle
                            cx="50"
                            cy="50"
                            r="45"
                            className="progress-circle-fill"
                            style={{ strokeDashoffset }}
                        ></circle>
                    </svg>
                    <div className="progress-text">
                        <span className="progress-current">{data.verified_count}</span>
                        <span className="progress-total">/ {data.threshold}</span>
                    </div>
                </div>
                <div className="progress-bar-container">
                    <div className="progress-bar">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                    <div className="progress-labels">
                        <span>0 users</span>
                        <span>{progressPercent}%</span>
                        <span>{data.threshold} users</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
