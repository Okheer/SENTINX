# SENTINX React Dashboard - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd /home/maanya-jha/Desktop/SENTINX/dashboard
npm install
```

### 2. Development Server

```bash
npm run dev
```

The dashboard will automatically open at `http://localhost:5173`

### 3. Build for Production

```bash
npm run build
npm run preview
```

---

## Project Structure

```
dashboard/
├── src/
│   ├── components/
│   │   ├── Header.jsx                    # Top header with logo and status
│   │   ├── MetricsSection.jsx             # 4 metric cards (top row)
│   │   ├── SlashingBanner.jsx             # Deadline countdown banner
│   │   ├── MainContent.jsx                # Left & right column layout
│   │   ├── BottomSection.jsx              # Attestation feed & charts
│   │   ├── AttestationFeed.jsx            # Live transaction feed
│   │   ├── GrowthChart.jsx                # Chart.js line chart
│   │   ├── AccessControlMatrix.jsx        # Role permission table
│   │   ├── Toast.jsx                      # Toast notifications
│   │   └── cards/
│   │       ├── MilestoneCard.jsx          # Progress circle & bars
│   │       ├── PhaseCard.jsx              # Phase state machine
│   │       ├── YieldCard.jsx              # Yield flow display
│   │       ├── MoneyFlowCard.jsx          # Capital movement timeline
│   │       ├── ContractsCard.jsx          # Contract addresses
│   │       └── StatsCard.jsx              # Agent status metrics
│   ├── hooks/
│   │   └── useAgentStatus.js              # Custom hook for API polling
│   ├── styles/
│   │   ├── App.css                        # Root styles & variables
│   │   ├── Header.css                     # Header styling
│   │   ├── Metrics.css                    # Metric cards styling
│   │   ├── SlashingBanner.css             # Banner styling
│   │   ├── MainContent.css                # Layout structure
│   │   ├── Cards.css                      # All card component styles
│   │   ├── BottomSection.css              # Bottom section layout
│   │   ├── AttestationFeed.css            # Feed styling
│   │   ├── Charts.css                     # Chart container styles
│   │   ├── AccessControlMatrix.css        # Table styling
│   │   └── Toast.css                      # Toast notification styles
│   ├── App.jsx                            # Main app component
│   └── main.jsx                           # Vite entry point
├── index.html                             # HTML template
├── package.json                           # Dependencies
├── vite.config.js                         # Vite configuration
├── .gitignore                             # Git ignore rules
├── README.md                              # Project README
└── SETUP_GUIDE.md                         # This file
```

---

## Features Overview

### 📊 Real-Time Metrics
- Grant Locked: $50,000 USDC
- Verified Users: Live count / 50 target
- Yield Earned: Live calculations
- Bots Rejected: Live count

### ⚡ Slashing Countdown
- Shows days remaining until May 15, 2026
- Animated progress bar
- Auto-fires slash() if deadline passes

### 🎯 Milestone Progress
- Animated SVG progress circle
- Linear progress bar
- Percentage display
- Real-time user count updates

### 📋 Phase State Machine
- PENDING → ACTIVE → COMPLETE states
- Visual indicators for each phase
- Current state highlighting

### 💰 Capital Movement
- 4-step timeline (VC Deposit → Collateral → Deploy → Fees)
- Live amount tracking
- Visual flow diagram

### 📈 Growth Chart
- Line chart showing verified users per cycle
- Real-time data updates
- Smooth animations

### 🔐 Access Control Matrix
- Role-based permission table
- Person A: Release only
- Person B: Scan, Attest, Yield
- Person C: Submit only

---

## API Integration

The dashboard polls the agent API at http://localhost:3001/status every 4 seconds.

### Expected API Response

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

---

## Customization

### Change Colors
Edit CSS variables in `src/styles/App.css`:

```css
:root {
  --color-primary: #6366f1;        /* Indigo */
  --color-success: #10b981;        /* Green */
  --color-warning: #f59e0b;        /* Amber */
  --color-danger: #ef4444;         /* Red */
  --color-info: #0ea5e9;           /* Cyan */
  /* ... etc */
}
```

### Change Poll Interval
In `src/App.jsx`, modify the fetch interval:

```jsx
const { data } = useAgentStatus(4000); // 4000ms = 4 seconds
```

### Change API Endpoint
In `src/hooks/useAgentStatus.js`:

```javascript
const response = await fetch('http://your-api:3001/status');
```

---

## Performance Optimizations

- ✅ Memoized components for efficiency
- ✅ CSS animations use GPU acceleration
- ✅ Lazy loading of Chart.js
- ✅ Optimized re-renders with React hooks
- ✅ Responsive design with mobile-first approach

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Development Tips

### Debug API Calls
Set `debug: true` in `useAgentStatus` hook to log all API responses.

### Hot Module Replacement (HMR)
Vite supports HMR out of the box. Changes to components will hot-reload automatically.

### Build Optimization
Production build includes:
- Tree-shaking (unused code removed)
- Code splitting
- Asset minification
- CSS optimization

### File Size
- Development: ~2MB (unminified)
- Production: ~150KB (gzipped)

---

## Troubleshooting

### Dashboard won't connect to agent
1. Make sure SENTINX agent is running on http://localhost:3001
2. Check browser console for CORS errors
3. Verify agent is responding to GET /status

### Chart not rendering
1. Check Chart.js is properly installed: `npm list chart.js`
2. Verify data format matches expected schema
3. Check browser console for errors

### Styles not applying
1. Clear browser cache: Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
2. Rebuild: `npm run build`
3. Check for CSS conflicts in DevTools

---

## Next Steps

1. Start the agent: `cd ../agent && npm start`
2. Start the dashboard: `npm run dev`
3. Open http://localhost:5173 in your browser
4. Watch real-time data flow!

---

## License

MIT © 2026 SENTINX
