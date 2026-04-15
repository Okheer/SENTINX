# SENTINX Dashboard

A modern, interactive React-based real-time dashboard for monitoring the SENTINX autonomous sentry agent.

## Features

- **Live Metrics**: Real-time display of grant locked, verified users, yield earned, and bots rejected
- **Slashing Countdown**: Live countdown timer with slash protection monitoring
- **Milestone Progress**: Animated progress circle and bar tracking verified user target
- **Phase State Machine**: Visual state tracking (PENDING → ACTIVE → COMPLETE)
- **Yield Management**: Real-time yield deployment and earnings display
- **Capital Flow**: Complete timeline of all capital movements
- **On-Chain Contracts**: Contract addresses with copy-to-clipboard functionality
- **Live Attestation Feed**: Real-time stream of pass/fail attestation events
- **Growth Chart**: Line chart showing verified users per cycle
- **Access Control Matrix**: Role-based permission matrix

## Tech Stack

- **React 18**: Modern React with hooks
- **Vite**: Fast build tool and dev server
- **Chart.js + react-chartjs-2**: Interactive charts
- **CSS3**: Modern styling with CSS variables and animations

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The dashboard will open at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
dashboard/
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── MetricsSection.jsx
│   │   ├── SlashingBanner.jsx
│   │   ├── MainContent.jsx
│   │   ├── BottomSection.jsx
│   │   ├── AttestationFeed.jsx
│   │   ├── GrowthChart.jsx
│   │   ├── AccessControlMatrix.jsx
│   │   ├── Toast.jsx
│   │   └── cards/
│   │       ├── MilestoneCard.jsx
│   │       ├── PhaseCard.jsx
│   │       ├── YieldCard.jsx
│   │       ├── MoneyFlowCard.jsx
│   │       ├── ContractsCard.jsx
│   │       └── StatsCard.jsx
│   ├── styles/
│   │   ├── App.css
│   │   ├── Header.css
│   │   ├── Metrics.css
│   │   ├── SlashingBanner.css
│   │   ├── MainContent.css
│   │   ├── Cards.css
│   │   ├── BottomSection.css
│   │   ├── AttestationFeed.css
│   │   ├── Charts.css
│   │   ├── AccessControlMatrix.css
│   │   └── Toast.css
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## API Integration

The dashboard polls the SENTINX agent API every 4 seconds:

```
GET http://localhost:3001/status
```

Expected response format:
```json
{
  "sentry_wallet": "0x...",
  "verified_count": 0,
  "threshold": 50,
  "threshold_reached": false,
  "bots_rejected": 0,
  "humans_verified": 0,
  "deployed_usdc": "0.00",
  "yield_earned_usd": "0.00",
  "deal_state": "PENDING",
  "cycle_count": 0,
  "contracts_ready": false
}
```

## Styling

The dashboard uses CSS variables for theming. All colors, spacing, and animations can be customized via the `:root` CSS variables in `src/styles/App.css`.

### Color Palette

- **Primary**: `#6366f1` (Indigo)
- **Success**: `#10b981` (Green)
- **Warning**: `#f59e0b` (Amber)
- **Danger**: `#ef4444` (Red)
- **Info**: `#0ea5e9` (Cyan)
- **Dark BG**: `#0f172a`
- **Card BG**: `#1a2332`

## Responsive Design

The dashboard is fully responsive and adapts to:
- Desktop (1024px+)
- Tablet (768px - 1024px)
- Mobile (< 768px)

## License

MIT
