import { useEffect, useState } from 'react';

export function useAgentStatus(pollInterval = 4000) {
    const [data, setData] = useState({
        sentry_wallet: '0x...',
        verified_count: 0,
        threshold: 50,
        threshold_reached: false,
        bots_rejected: 0,
        humans_verified: 0,
        deployed_usdc: '0.00',
        yield_earned_usd: '0.00',
        deal_state: 'PENDING',
        cycle_count: 0,
        contracts_ready: false,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStatus = async () => {
            setLoading(true);
            try {
                const response = await fetch('http://localhost:3001/status');
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const newData = await response.json();
                setData(newData);
                setError(null);
            } catch (err) {
                setError(err.message);
                console.error('Failed to fetch status:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, pollInterval);
        return () => clearInterval(interval);
    }, [pollInterval]);

    return { data, loading, error };
}
