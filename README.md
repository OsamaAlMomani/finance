# Finance Desktop App

Desktop-first personal finance app built with React, Vite, Electron, and SQLite.

## Stack

- UI: React + TypeScript + Tailwind CSS
- Desktop shell: Electron
- Data layer: `better-sqlite3`
- Unit/integration testing: Vitest
- UI automation/regression: Playwright (desktop Chromium baseline)

## Quick Start

1. Install dependencies:
   - `npm install`
2. Rebuild native SQLite module for local Node runtime:
   - `npm run rebuild:node`
3. Run app:
   - Web UI only: `npm run dev:react`
   - Full desktop app (React + Electron): `npm run dev`

## Build

- Production web bundle: `npm run build`
- Desktop package (dir): `npm run pack`
- Desktop installers: `npm run dist`

## Testing

- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- Desktop UI regression matrix (100+ checks): `npm run test:e2e:regression-matrix`
- Desktop UI visual/style regression: `npm run test:e2e:regression-ui`
- Functional button sweep: `npm run test:e2e:functional-buttons`
- Full desktop UI pipeline: `npm run test:e2e:desktop`

## Quality

- Lint: `npm run lint`
- Coverage: `npm run test:coverage`

## Project Docs

- Roadmap/TODO: `docs/specs/TODO.md`

## Notes

- E2E suite is configured for desktop validation first.
- Playwright starts the Vite dev server automatically from config.
