import { useEffect, useState } from 'react';

export function useAgentStatus(pollInterval = 4000) {
    const [data, setData] = useState({
        sentry_wallet: '0x00223b332561f6eb2d640adea92c1fc891944f5f0',
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
        // Added to support the terminal logs we set up
        logs: [] 
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStatus = async () => {
            setLoading(true);
            try {
                // Corrected to port 3001 and added /api/ to match the server.js path
                const response = await fetch('http://localhost:3001/api/status');
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const newData = await response.json();
                
                // Update state while preserving any fields not sent by the backend
                setData(prevData => ({
                    ...prevData,
                    ...newData
                }));
                
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