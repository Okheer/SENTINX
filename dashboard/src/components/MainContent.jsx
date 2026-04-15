import React from 'react';
import '../styles/MainContent.css';
import MilestoneCard from './cards/MilestoneCard';
import PhaseCard from './cards/PhaseCard';
import YieldCard from './cards/YieldCard';
import MoneyFlowCard from './cards/MoneyFlowCard';
import ContractsCard from './cards/ContractsCard';
import StatsCard from './cards/StatsCard';

export default function MainContent({ data, copyToClipboard }) {
    return (
        <section className="content-section">
            <div className="left-column">
                <MilestoneCard data={data} />
                <PhaseCard data={data} />
                <YieldCard data={data} />
            </div>
            <div className="right-column">
                <MoneyFlowCard data={data} />
                <ContractsCard data={data} copyToClipboard={copyToClipboard} />
                <StatsCard data={data} />
            </div>
        </section>
    );
}
