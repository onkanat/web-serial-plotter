[![CI](https://github.com/atomic14/web-serial-plotter/actions/workflows/ci.yml/badge.svg)](https://github.com/atomic14/web-serial-plotter/actions/workflows/ci.yml)

# Web Serial Plotter

Real‑time, beautiful, and zero‑friction plotting for any serial device — right in your browser.

> Connect an Arduino, sensor board, or any UART‑speaking device and get instant charts with no drivers or native apps. Built with Vite + React + TypeScript + Tailwind CSS.

## Goals

- Deliver a delightful, modern UI that “just works” for live serial data.
- Make it easy to explore and debug data streams with rich interactions.
- Keep everything local in the browser — fast, private, and portable.

## Status

This is an active work‑in‑progress. We’re building the core experience and polishing the UI to be production‑quality. Contributions and early feedback are very welcome.

## Key Features (planned)

- Multi‑series real‑time plotting (CSV/space‑separated values per line)
- Autoscaling, pan/zoom, pause/freeze, and cursors
- Channel management, renaming, and color theming
- Rolling buffer with smart downsampling for smooth 60 FPS rendering
- Data inspectors: min/max/avg, deltas, peak hold
- Import/export sessions, CSV export, and screenshot capture
- Configurable baud rate and line protocol helpers
- Optional binary framing and checksum helpers

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

## Using Web Serial (in the app)

1. Click “Connect” and choose your serial device when prompted.
2. Select a baud rate that matches your device.
3. Start streaming lines of numbers (comma, space, or tab‑separated). Each line becomes a point for one or more series.
4. Use the controls to zoom, pause, or export as needed.

Example device output:

```text
# time(ms), ax, ay, az
0, 0.01, 0.02, 0.98
10, 0.02, 0.01, 0.99
20, 0.03, 0.00, 1.01
```

Notes:

- If no timestamp is present, the app will timestamp on receipt.
- Labels starting with `#` may be used as hints for channel names (planned).

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

- `npm run dev` – Start the dev server
- `npm run build` – Type‑check and build for production
- `npm run preview` – Preview the production build locally
- `npm run lint` – Run ESLint

## Project Structure

```
.
├─ src/
│  ├─ main.tsx        # App entry
│  ├─ App.tsx         # Root component and routing
│  ├─ index.css       # Tailwind entry
│  └─ assets/         # Static assets
├─ public/            # Static public files
├─ vite.config.ts     # Vite config
└─ eslint.config.js   # ESLint config
```

## Roadmap

- First‑class device setup flow (port + baud + presets)
- High‑performance canvas/WebGL renderer with adaptive downsampling
- Rich interactions: pan/zoom, cursors, stats overlays, peak markers
- Channel management UI and theming
- Session save/load, CSV export, and screenshots
- Binary protocol helpers (CBOR/SLIP/COBS) and checksum tooling
- Accessibility and keyboard navigation

## Contributing

Ideas, issues, and pull requests are welcome. If you’re testing with specific hardware, please share device details and sample output so we can improve defaults and parsing.

## License

TBD.

