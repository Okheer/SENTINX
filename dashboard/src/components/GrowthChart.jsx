import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import '../styles/Charts.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function GrowthChart({ data }) {
    const [chartData, setChartData] = useState({
        labels: [],
        datasets: [],
    });

    useEffect(() => {
        // Simulate growth data
        const cycles = [];
        const users = [];

        for (let i = 0; i <= data.cycle_count; i++) {
            cycles.push(`Cycle ${i}`);
            // Simulate linear growth
            users.push(Math.min(i * 2, data.verified_count));
        }

        setChartData({
            labels: cycles,
            datasets: [
                {
                    label: 'Verified Users per Cycle',
                    data: users,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 6,
                },
            ],
        });
    }, [data.cycle_count, data.verified_count]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: '#94a3b8',
                    font: {
                        size: 12,
                        weight: '500',
                    },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#f1f5f9',
                bodyColor: '#cbd5e1',
                borderColor: '#334155',
                borderWidth: 1,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 50,
                grid: {
                    color: 'rgba(51, 65, 85, 0.3)',
                    drawBorder: false,
                },
                ticks: {
                    color: '#64748b',
                    font: {
                        size: 11,
                    },
                },
            },
            x: {
                grid: {
                    display: false,
                    drawBorder: false,
                },
                ticks: {
                    color: '#64748b',
                    font: {
                        size: 11,
                    },
                },
            },
        },
    };

    return (
        <div className="card chart-card">
            <h2 className="card-title">Growth Curve</h2>
            <div className="chart-container">
                <Line data={chartData} options={options} />
            </div>
        </div>
    );
}
