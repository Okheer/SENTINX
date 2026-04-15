import React, { useState } from 'react';
import './styles/App.css';
import { useAgentStatus } from './hooks/useAgentStatus';
import Header from './components/Header';
import MetricsSection from './components/MetricsSection';
import SlashingBanner from './components/SlashingBanner';
import MainContent from './components/MainContent';
import BottomSection from './components/BottomSection';
import Toast from './components/Toast';

export default function App() {
    const { data } = useAgentStatus(4000);
    const [toast, setToast] = useState(null);
    const [attestationFeed, setAttestationFeed] = useState([
        {
            time: new Date().toLocaleTimeString(),
            badge: 'INIT',
            type: 'notice',
            msg: 'Dashboard initialized',
        },
        {
            time: new Date().toLocaleTimeString(),
            badge: 'SCAN',
            type: 'pending',
            msg: 'Waiting for first submissions...',
        },
    ]);

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!');
    };

    return (
        <div className="app-wrapper">
            <Header />
            <main className="main-container">
                <MetricsSection data={data} />
                <SlashingBanner />
                <MainContent data={data} copyToClipboard={copyToClipboard} />
                <BottomSection attestationFeed={attestationFeed} data={data} />
            </main>
            {toast && <Toast message={toast} />}
        </div>
    );
}
