import React from 'react';
import '../styles/BottomSection.css';
import AttestationFeed from './AttestationFeed';
import GrowthChart from './GrowthChart';
import AccessControlMatrix from './AccessControlMatrix';

export default function BottomSection({ attestationFeed, data }) {
    return (
        <section className="bottom-section">
            <div className="feed-column">
                <AttestationFeed feed={attestationFeed} />
            </div>
            <div className="charts-column">
                <GrowthChart data={data} />
                <AccessControlMatrix />
            </div>
        </section>
    );
}
