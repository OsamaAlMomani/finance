# Finance Desktop App

Desktop-first personal finance app built with React, Vite, Electron, and SQLite.

## Stack

- UI: React + TypeScript + Tailwind CSS
- Desktop shell: Electron
- Data layer: `better-sqlite3`
- Unit/integration testing: Vitest
- UI automation/regression: Playwright (desktop Chromium baseline)

## Core Stack for Electron Finance Dashboard

| Layer | Best Choice | Why | Status |
|---|---|---|---|
| Base | Electron + Vite | Fast desktop iteration and hot reload | Implemented |
| Framework | React + TypeScript | Component-driven and type-safe UI | Implemented |
| Styling | Tailwind + SCSS + shadcn-style patterns | Fast responsive UI with flexible custom themes | Implemented (Tailwind + SCSS), shadcn patterns staged |
| Charts | Recharts (TradingView optional) | Lightweight charting for finance dashboards | Implemented (Recharts) |
| State | Zustand + TanStack Query | Simple UI store + synchronized async cache | Implemented in foundation |
| Local DB | SQLite via better-sqlite3 | Fast offline storage | Implemented |
| ORM | Drizzle ORM | Type-safe SQL schema/migrations | Scaffolded (`drizzle.config.ts`, schema) |
| Auth | electron-store + bcrypt | Local credential hashing and secure persistence | Scaffolded (credential service + IPC channels) |
| IPC | Electron IPC main <-> renderer | Isolated Node/UI bridge | Implemented |

### Current Implementation Notes (`2026-03-25`)

- Zustand is now wired for dashboard UI visibility state:
  - `src/ui/state/uiStore.ts`
- TanStack Query provider + global finance data invalidation bridge:
  - `src/ui/query/queryClient.ts`
  - `src/ui/query/financeQueryKeys.ts`
  - `src/ui/components/FinanceDataSync.tsx`
  - `src/ui/main.tsx`
- Drizzle ORM scaffold and scripts:
  - `drizzle.config.ts`
  - `src/services/db/schema.ts`
  - scripts: `db:drizzle:generate`, `db:drizzle:migrate`, `db:drizzle:push`
- Secure local auth scaffold (ready for UI flow integration):
  - `src/electron/credentialStore.js`
  - IPC channels: `auth-store-credential`, `auth-verify-credential`, `auth-clear-credential`

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

## Import/Export Deep-Dive Scope

- This section is a focused deep-dive for the Import/Export module and directly related backend paths:
  - `src/ui/pages/ImportExport.tsx`
  - `src/ui/styles/index.css` (layout behavior for this page)
  - `src/electron/ipcHandlers.js` (import/export backup IPC endpoints)
  - `src/services/databaseService.js` (reset/restore behavior)

## Import/Export Gaps (Priority)

1. Restore safety risk: current flow resets data before restore finishes.
2. Missing permission guard for destructive backup/restore endpoints.
3. Incomplete data validation for imported values (numbers, booleans, dates, enums).
4. CSV parsing/escaping is fragile for edge cases (quotes/newlines/complex cells).
5. Heavy backup path fetches transactions multiple times.
6. Preview and apply logic are duplicated, increasing drift risk.
7. Some user-facing strings are hardcoded instead of i18n keys.
8. Existing i18n error keys are not consistently used.
9. No focused automated tests for critical import/restore scenarios.

## Import/Export Fix Plan

1. Safety first:
   - make restore atomic (avoid permanent reset on failed restore)
   - enforce permission checks for reset/restore and V2 upgrade actions
2. Correctness:
   - add shared validators for import rows
   - reject invalid rows early in preview and apply paths
3. CSV hardening:
   - replace manual CSV handling with robust escaping/parsing behavior
4. Performance:
   - fetch transactions once during ZIP export and derive related payload pieces from that data
5. Maintainability:
   - extract shared row mapping/validation logic used by both preview and apply
6. UX and i18n:
   - move hardcoded strings to translation keys
   - improve destructive action UX with clear confirmations/messages
7. Quality gate:
   - add tests for import validation, CSV edge cases, and backup restore failure paths

## Whole-App Analysis Scope

- Audit date: `2026-03-25`
- Frontend pages reviewed:
  - `src/ui/pages/Alerts.tsx`
  - `src/ui/pages/Auth.tsx`
  - `src/ui/pages/Bills.tsx`
  - `src/ui/pages/Budget.tsx`
  - `src/ui/pages/Dashboard.tsx`
  - `src/ui/pages/Goals.tsx`
  - `src/ui/pages/ImportExport.tsx`
  - `src/ui/pages/Loans.tsx`
  - `src/ui/pages/Plans.tsx`
  - `src/ui/pages/ProfileSelect.tsx`
  - `src/ui/pages/Reports.tsx`
  - `src/ui/pages/Scenarios.tsx`
  - `src/ui/pages/Settings.tsx`
  - `src/ui/pages/Settlement.tsx`
  - `src/ui/pages/Sharing.tsx`
  - `src/ui/pages/Transactions.tsx`
  - `src/ui/pages/Users.tsx`
- Core desktop/data paths reviewed:
  - `src/electron/main.js`
  - `src/electron/preload.js`
  - `src/electron/ipcHandlers.js`
  - `src/services/databaseService.js`
  - `src/ui/App.tsx`
  - `src/ui/styles/index.css`

## Whole-App Gaps (Priority)

1. Permission checks are inconsistent across write paths:
   - explicit permission guard usage appears in `Reports` and `Sharing`, but not consistently in other mutation-heavy pages.
2. Destructive operations still have safety risk:
   - reset/restore and other destructive actions rely heavily on UI confirmation flows instead of layered backend safeguards.
3. UI density and squeeze issues in data-heavy pages:
   - very large page components (`ImportExport`, `Transactions`, `Scenarios`, `Loans`) combine many controls and views in a single layout, reducing flexibility on smaller windows.
4. Dialog/feedback UX is inconsistent:
   - app relies on mixed browser-native `alert/confirm/prompt` patterns instead of unified in-app modal/toast flows.
5. Validation logic is uneven:
   - number/date/enum coercion and parsing are implemented per-page with different strictness levels.
6. i18n coverage is partial:
   - several user-facing error and confirmation strings remain hardcoded in English.
7. IPC usage is too distributed in UI:
   - many pages call `window.electron.invoke(...)` directly, which increases duplication and weakens type-safe contracts.
8. Event invalidation is broad:
   - generic refresh events can cause over-fetch and make data flow harder to reason about.
9. Testing setup does not match risk level:
   - scripts assume unit/integration/e2e folders, but `tests/` is currently missing.
10. Component size and cohesion:
   - several page files are large (for example `ImportExport.tsx` >1200 lines), making regression risk and review cost higher.

## Whole-App Fix Plan

1. Safety and authorization baseline (Phase 1):
   - add centralized server-side permission enforcement for all mutation IPC handlers.
   - add backend guard rails for destructive operations (pre-checks, rollback-safe flows, auditable logging).
2. Layout flexibility for heavy pages (Phase 1):
   - refactor data-heavy views into compact option panels plus expandable detail panes.
   - ensure pages are vertically scrollable with minimum panel heights and responsive wrapping, so windows are not squeezed together.
3. Shared validation layer (Phase 1):
   - introduce reusable schema validators for numeric/date/enum/boolean parsing before DB writes.
4. Unified UX patterns (Phase 2):
   - replace browser-native dialogs with app modal/toast components and consistent error presentation.
5. IPC and state architecture cleanup (Phase 2):
   - add typed service wrappers/hooks for IPC calls to reduce direct `window.electron.invoke` usage in page components.
6. Large-file decomposition (Phase 2):
   - split oversized pages into feature modules (`components`, `hooks`, `services`, `utils`) with clear ownership.
7. i18n completion pass (Phase 2):
   - migrate all user-visible literals to translation keys and standardize error keys.
8. Test foundation rebuild (Phase 3):
   - restore `tests/` structure and add targeted unit/integration coverage for mutation flows and import/export edge cases.
   - add smoke e2e checks for critical flows (auth, transactions, import/export restore, reporting).
9. Performance pass (Phase 3):
   - remove duplicate fetch paths, add memoized selectors where needed, and reduce full-page reload patterns.
10. Definition of done for stabilization:
   - no unguarded destructive IPC mutations.
   - no data-heavy page blocked by fixed-height squeeze behavior.
   - no hardcoded UI strings in audited pages.
   - CI green for lint + core unit/integration + critical e2e smoke set.

## Phase Build Status (Execution)

- Status date: `2026-03-25`

### Phase 1 (Safety + Validation + Layout Flexibility)

- Implemented:
  - centralized mutation permission checks at IPC handler registration (`onMutation`).
  - shared backend validators for string/number/enum/date/boolean normalization.
  - atomic restore path with rollback-safe `db-replace-all` service flow.
  - import/export ZIP uses single transaction fetch and rollback-safe replace endpoint.
  - import/export layout supports compact quick windows + full feature view with vertical scrolling.

### Phase 2 (UX + IPC Cleanup + Decomposition + i18n pass)

- Implemented (current pass):
  - shared UI IPC layer expanded in `src/ui/services/ipcClient.ts`.
  - shared data invalidation helper added (`src/ui/services/dataEvents.ts`).
  - migrated critical pages (`Reports`, `Settlement`, `Sharing`, `Scenarios`) from direct IPC calls to shared client.
  - removed native `alert/prompt` patterns from `Reports` and `Settlement`; `Scenarios` now uses in-page delete confirmation state.
  - added translation keys for migrated page copy and status/notice messages.

- Pending in future passes:
  - complete migration of remaining pages that still call `window.electron.invoke(...)` directly.
  - replace remaining native `confirm(...)` calls in Import/Export and other pages with unified in-app dialog components.

### Phase 3 (Test Foundation + Targeted Coverage + Performance)

- Implemented (current pass):
  - restored test scaffold (`tests/setup.ts`).
  - added unit coverage for shared validators (`tests/unit/inputValidation.test.ts`).
  - added integration coverage for rollback-safe restore behavior (`tests/integration/database.restore-safety.test.ts`).

- Pending in future passes:
  - restore full e2e suite files and visual snapshots.
  - add smoke e2e coverage for auth, transaction lifecycle, and import/export restore flows.

## Phase 2 Algorithmic Analysis (Alternative Method)

- Objective: prioritize Phase 2 work (UX consistency, IPC architecture cleanup, large-file decomposition, i18n completion) using a scoring model instead of qualitative-only ranking.
- Audit date: `2026-03-25`

### Scoring model

1. `WRCI` (Weighted Refactor-Criticality Index) per page:
   - `WRCI = 0.30*SizeRisk + 0.25*IPCRisk + 0.20*UXRisk + 0.15*StateRisk + 0.10*I18nRisk`
2. `CouplingScore` per page:
   - `CouplingScore = 2*(unique IPC channels) + 3*(mutation IPC calls)`

### Dataset snapshot

- Frontend pages scanned: `17`
- Direct page-level `window.electron.invoke(...)` calls: `141`
- Unique IPC channels touched by pages: `81`
- Pages using native `alert/confirm/prompt`: `14 / 17`
- Large page files (`>= 600` LOC): `6`
- Pages with `0` translation calls (`t(...)`): `5`
  - `Alerts.tsx`, `Reports.tsx`, `Scenarios.tsx`, `Settlement.tsx`, `Sharing.tsx`

### Highest-risk modules (Phase 2 priority)

1. `ImportExport.tsx`:
   - `WRCI 69.20`, `CouplingScore 105`
   - 1254 LOC, 55 direct invokes, 39 unique channels, mixed compact/full UX + hardcoded confirmations.
2. `Scenarios.tsx`:
   - `WRCI 53.45`, `CouplingScore 18`
   - 813 LOC, no i18n layer, hardcoded UX copy and native confirm flow.
3. `Transactions.tsx`:
   - `WRCI 52.70`, `CouplingScore 23`
   - 859 LOC, high hook/state density, direct IPC in page-level mutation paths.
4. `Settings.tsx`:
   - `WRCI 44.35`, `CouplingScore 18`
   - mixed concerns (settings + categories + users + avatar updates) with repeated direct IPC calls.
5. `Sharing.tsx`:
   - `WRCI 44.30`, `CouplingScore 27`
   - permission-sensitive module with direct invokes + hardcoded alerts.
6. `Loans.tsx`:
   - `WRCI 39.30`, `CouplingScore 21`
   - medium coupling and modal/mutation complexity.

### Evidence anchors for Phase 2 work

- Generic IPC surface (single invoke gateway): `src/electron/preload.js` lines `25-35`
- Broad mutation fanout event: `src/electron/preload.js` lines `6-29`
- Hardcoded confirm in heavy module: `src/ui/pages/ImportExport.tsx` line `805`
- Hardcoded messages in i18n-missing pages:
  - `src/ui/pages/Scenarios.tsx` lines `396`, `460`, `468`, `475`
  - `src/ui/pages/Sharing.tsx` lines `90`, `108`
  - `src/ui/pages/Settlement.tsx` lines `63`, `69`, `76`
  - `src/ui/pages/Reports.tsx` line `82`
- Manual invalidation dispatch spread across pages: multiple `window.dispatchEvent(new CustomEvent('finance:data-changed'))` calls in `Budget`, `Goals`, `Loans`, `Sharing`, `Reports`, `Settlement`, `Scenarios`, `Alerts`.

### Phase 2 execution order (algorithm-driven)

1. IPC wrapper foundation:
   - add typed UI-side API wrapper (single module) and migrate top 5 ranked pages first.
2. Unified dialog/feedback system:
   - replace browser-native `alert/confirm/prompt` in highest-risk pages with shared app dialog/toast components.
3. Decompose large pages:
   - split `ImportExport`, `Scenarios`, and `Transactions` into `components + hooks + domain helpers`.
4. i18n completion pass:
   - add translation keys for `Scenarios`, `Sharing`, `Settlement`, `Reports`, then remove hardcoded strings.
5. Data invalidation normalization:
   - centralize `finance:data-changed` emit/listen helper to avoid ad-hoc page-level event wiring.

## New Feature Suggestions (With Analysis)

1. Transaction Inbox:
   - import/capture queue with auto-category suggestions and bulk approve/reject.
2. Cashflow Calendar:
   - day-by-day projected balance with risk-day highlighting.
3. Rules Builder:
   - "if merchant/tag text matches X -> set category/account/label Y" automation.
4. Scenario Compare Board:
   - compare 2-3 saved scenarios side-by-side with deltas.
5. Monthly Review Wizard:
   - guided workflow: settlement -> report generation -> share snapshot.
6. Safe Restore Points:
   - automatic rollback snapshot before destructive operations.

## Feature Analysis Matrix

1. Transaction Inbox:
   - Impact: `High`
   - Effort: `Medium`
   - Depends on: `Rules Builder`, typed IPC wrappers, consistent dialogs.
2. Cashflow Calendar:
   - Impact: `High`
   - Effort: `Medium`
   - Depends on: settlement/report data, alerts, recurring/bills/loans read APIs.
3. Rules Builder:
   - Impact: `High`
   - Effort: `Medium`
   - Depends on: classification rules storage + transaction write pipeline.
4. Scenario Compare Board:
   - Impact: `Medium`
   - Effort: `Low-Medium`
   - Depends on: existing scenarios data and reporting widgets.
5. Monthly Review Wizard:
   - Impact: `High`
   - Effort: `Medium`
   - Depends on: settlement, reports, sharing permissions modules.
6. Safe Restore Points:
   - Impact: `Very High`
   - Effort: `Medium`
   - Depends on: backup/restore hardening and atomic restore behavior.

## Connection Plan (How These Features Work Together)

1. Build shared foundation first:
   - typed UI IPC service layer (`transactions`, `reports`, `sharing`, `importExport` domains).
   - unified app dialogs/toasts and standardized mutation/error handling.
2. Ship `Rules Builder` before `Transaction Inbox`:
   - inbox suggestions should consume saved rule definitions immediately.
3. Connect `Transaction Inbox` to downstream analytics:
   - approvals trigger one normalized data-change event, then refresh dashboard/budget/goals/reports.
4. Add `Cashflow Calendar` as the common risk surface:
   - combine bills, loans, recurring items, and projected balances in one timeline.
   - feed high-risk days into alerts and monthly review.
5. Layer `Scenario Compare Board` on top of existing scenarios:
   - no new storage model required initially; use current `db-get-scenarios` + compare view.
6. Add `Monthly Review Wizard` as orchestration:
   - step 1 finalize/reopen settlement.
   - step 2 generate/validate monthly report.
   - step 3 create/export sharing snapshot.
7. Wrap destructive paths with `Safe Restore Points`:
   - before reset/restore/upgrade flows, auto-create a restore point.
   - expose restore history in Import/Export for one-click rollback.
8. Delivery sequence:
   - `Sprint A`: foundation + Rules Builder.
   - `Sprint B`: Transaction Inbox + Scenario Compare Board.
   - `Sprint C`: Cashflow Calendar + Monthly Review Wizard.
   - `Sprint D`: Safe Restore Points + hardening/tests.

## External API Enhancements

- Implemented (`2026-03-25`):
  - `Dashboard > Global FX Pulse` now uses the free Frankfurter API (ECB rates) with:
    - base currency mapped from app settings.
    - target watchlist (`USD`, `EUR`, `GBP`, `JOD`, `SAR`, `AED`) excluding base.
    - cache fallback in local storage when live request fails.
    - stale data indicator and manual refresh control.
- Next low-cost API additions (optional):
  - World Bank indicators for inflation/GDP trend overlays in dashboard monitor.
  - SEC EDGAR feed for listed-company event monitoring in investment-focused profiles.
  - Open-Meteo severe weather signal to annotate bill/expense anomalies (energy/transport risk).

## Notes

- E2E suite is configured for desktop validation first.
- Playwright starts the Vite dev server automatically from config.
