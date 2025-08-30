[![CI](https://github.com/atomic14/web-serial-plotter/actions/workflows/ci.yml/badge.svg)](https://github.com/atomic14/web-serial-plotter/actions/workflows/ci.yml)

# Web Serial Plotter

Real‑time, beautiful, and zero‑friction plotting for any serial device — right in your browser.

> Connect an Arduino, sensor board, or any UART‑speaking device and get instant charts with no drivers or native apps. Built with Vite + React + TypeScript + Tailwind CSS.

## Goals

- Deliver a delightful, modern UI that “just works” for live serial data.
- Make it easy to explore and debug data streams with rich interactions.
- Keep everything local in the browser — fast, private, and portable.

## Status

**Production Ready** - Core functionality is complete and stable. The application successfully handles real-time serial data plotting with professional-grade performance and user experience.

## Current Features

✅ **Real-time Plotting**
- Multi-series plotting from CSV/space/tab-separated serial data
- Automatic series detection from header lines (e.g., `# time ax ay az`)
- High-performance ring buffer with configurable history (up to 12K+ points)
- Smooth 60 FPS rendering with HTML5 Canvas

✅ **Interactive Controls**
- Mouse/touch pan and zoom with momentum scrolling
- Pinch-to-zoom support on touch devices
- Ctrl+wheel zoom for precise control
- Play/pause (freeze) functionality
- Auto-scaling Y-axis with manual override

✅ **Data Analysis**
- Real-time statistics: min/max/mean/median/stddev
- Live histograms for each data series
- Configurable time display (absolute/relative)
- Sample rate monitoring

✅ **Channel Management**
- Series renaming and color customization
- Interactive legend with click-to-edit
- Up to 8 default color themes

✅ **Export & Testing**
- PNG screenshot export (plot + individual stats cards)
- Built-in signal generator for testing (sine, noise, ramp)
- Configurable sample rates and amplitudes

✅ **User Experience**
- Dark/light theme toggle
- Responsive design
- Browser-based (no drivers required)
- Real-time connection status

## Quick Start (development)

Prerequisites:

- Node.js 18+ (LTS recommended)
- A Chromium‑based browser that supports the Web Serial API (Chrome, Edge, Opera)

Install and run:

```bash
npm install
npm run dev
```

Open the printed local URL (Vite default is `http://localhost:5173`).

## Using the Application

### Serial Device Connection
1. Click **"Connect"** and choose your serial device when prompted
2. Select the appropriate **baud rate** for your device
3. Start streaming data - the app supports CSV, space, or tab-separated values

### Data Format
Your device should send lines of numeric data:
```text
# Optional header defines series names
# time(ms), ax, ay, az
0, 0.01, 0.02, 0.98
10, 0.02, 0.01, 0.99
20, 0.03, 0.00, 1.01
```

### Interactive Controls
- **Pan**: Click and drag on the plot
- **Zoom**: Ctrl+wheel or pinch on touch devices
- **Freeze**: Click pause button to stop live updates
- **Screenshot**: Use camera button to export PNG images
- **Series**: Click legend entries to edit names and colors

### Built-in Signal Generator
For testing without hardware:
1. Use the **generator panel** in the header
2. Choose signal type: Sine (phased), Noise, or Ramp  
3. Adjust sample rate and click **"Start"**
4. Data will appear as if from a real device

### Statistics Panel
The bottom panel shows real-time analytics:
- **Statistics**: min/max/mean/median/standard deviation
- **Histogram**: Live distribution visualization
- **Export**: Individual screenshot per data series

## Browser Support

The Web Serial API is supported in modern Chromium‑based browsers:

- Chrome 89+
- Edge 89+
- Opera (current versions)

Firefox and Safari do not support Web Serial at this time. On desktop, use Chrome or Edge for the best experience.

## Security & Privacy

- You explicitly grant serial port access per device and per origin using the browser’s permission prompt.
- All data stays local to your machine. The app does not upload your serial data.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS v4 (via `@tailwindcss/vite`)

## Scripts

- `npm run dev` – Start the development server
- `npm run build` – Type‑check and build for production
- `npm run preview` – Preview the production build locally
- `npm run lint` – Run ESLint code quality checks
- `npm run typecheck` – Run TypeScript type checking
- `npm test` – Run the test suite

## Project Structure

```
.
├─ src/
│  ├─ main.tsx              # App entry point
│  ├─ App.tsx               # Main application component
│  ├─ components/           # React components
│  │  ├─ PlotCanvas.tsx     # High-performance canvas renderer
│  │  ├─ Header.tsx         # Connection controls
│  │  ├─ Legend.tsx         # Interactive series legend
│  │  ├─ StatsPanel.tsx     # Real-time statistics
│  │  ├─ GeneratorPanel.tsx # Test signal generator
│  │  └─ ui/               # Reusable UI components
│  ├─ hooks/               # Custom React hooks
│  │  ├─ useSerial.ts      # Web Serial API integration
│  │  ├─ useZoomControls.ts # Zoom interaction logic
│  │  └─ useMomentumScrolling.ts # Physics-based scrolling
│  ├─ store/               # Data management
│  │  ├─ RingStore.ts      # High-performance ring buffer
│  │  └─ dataStore.tsx     # React store integration
│  ├─ utils/               # Utility functions
│  │  ├─ coordinates.ts    # Coordinate transformations
│  │  └─ plotRendering.ts  # Canvas rendering utilities
│  └─ types/               # TypeScript definitions
├─ public/                 # Static assets
├─ vite.config.ts          # Build configuration
└─ eslint.config.js        # Code quality rules
```

## Roadmap

**Planned Enhancements:**
- CSV data export functionality
- Session save/load (plot configurations)
- Binary protocol support (CBOR/SLIP/COBS)
- Cursor/crosshair tools for precise measurements
- Advanced data processing filters
- Keyboard navigation and accessibility improvements
- Multiple device connection support

## Contributing

Ideas, issues, and pull requests are welcome. If you’re testing with specific hardware, please share device details and sample output so we can improve defaults and parsing.

## License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

**Summary**: This is free and open-source software. You can redistribute and modify it under the GPL v3 terms, ensuring it remains free software for all users.

