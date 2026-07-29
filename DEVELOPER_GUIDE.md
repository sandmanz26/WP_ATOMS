# Developer Guide — WLA / ATOMS Frontend Demo (`customer-contracts`)

This document is a complete technical reference for developers picking up this repository. It covers the tech stack, architecture, folder conventions, and a full module-by-module breakdown. It is written to be self-sufficient — you should not need to reverse-engineer the codebase from scratch after reading this.

> **Context**: This is a **frontend-only prototyping/demo repository** ("vibe coding") used to rapidly build and iterate on UI for the ATOMS platform's WLA (White-Label App) product line, based on PRD documents provided by the product team. There is **no backend, no authentication, and no persistence** — all data is in-memory mock data, and all "saves" are session-only React state updates that disappear on page refresh.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Getting Started](#2-getting-started)
3. [Project Structure](#3-project-structure)
4. [Architecture](#4-architecture)
5. [Module & File Conventions](#5-module--file-conventions)
6. [Module-by-Module Reference](#6-module-by-module-reference)
7. [Known Limitations](#7-known-limitations)
8. [Development & Verification Workflow](#8-development--verification-workflow)
9. [Adding a New Module](#9-adding-a-new-module)
10. [Path Aliases](#10-path-aliases)

---

## 1. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 18.3.1 |
| Language | TypeScript | 5.6.3 (strict mode) |
| Build tool | Vite | 5.4.10 |
| UI library | Ant Design (antd) | 5.21.0 |
| Icons | `@ant-design/icons` | 5.5.0 |
| Dates | `dayjs` | 1.11.13 |
| Maps (Live Tracking) | `@react-google-maps/api` | 2.20.8 |
| Maps (Tracking 2.0 only) | `leaflet` + `react-leaflet` | 1.9.4 / 4.2.1 |
| E2E/browser automation | `playwright` | 1.60.0 (installed but **not wired into any test suite** — used ad hoc for manual UI verification, see §8) |

**Not present**: no router library (routing is hand-rolled, see §4.1), no state management library (Redux/Zustand/etc. — everything is local `useState`/prop-drilling), no ESLint/Prettier config, no test runner config, no CI pipeline.

---

## 2. Getting Started

```bash
npm install
cp .env.example .env   # then fill in VITE_GOOGLE_MAPS_API_KEY
npm run dev            # starts Vite dev server (default port 5173, override with --port)
npm run build           # tsc typecheck + vite production build
npm run preview         # preview the production build locally
```

### Required environment variable

| Variable | Purpose |
|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Used by the Live Tracking pages (Google Maps JavaScript API + Directions API) for map rendering and route drawing. Without it, the live tracking pages will fail to load their map. |

### Typechecking only (no build)

```bash
npx tsc --noEmit
```
This is the fast way to catch type errors without running a full Vite build. Always run this after any code change before verifying in-browser.

---

## 3. Project Structure

```
/home/user/wp
├── .env.example
├── docs/
│   └── live-tracking-ux-audit.md      — UX audit doc that LiveTrackingTestingPage.tsx follows
├── index.html
├── package.json
├── tsconfig.json                       — app tsconfig (path alias, strict mode)
├── tsconfig.node.json                  — separate tsconfig for vite.config.ts
├── vite.config.ts                      — dev/build config + path alias (source of truth)
└── src/
    ├── App.tsx                         — root component; hand-rolled page routing
    ├── main.tsx                        — ReactDOM root + AntD ConfigProvider (global theme)
    ├── index.css
    ├── vite-env.d.ts                   — Vite env var typings
    ├── types/
    │   └── contract.ts                 — shared Contract/Trip/OtherCharge domain types
    ├── data/
    │   └── mockData.ts                 — shared mock Contract[] dataset
    └── components/
        ├── common/
        │   └── StatusBadge.tsx         — shared ContractStatus badge (Active/Upcoming/Ending/Ended/Voided)
        ├── layout/
        │   └── AppLayout.tsx           — shared sidebar + top bar chrome
        ├── contracts/                  — Customer Contracts module
        │   └── edit/                   — Contract edit sub-pages (own layout)
        ├── invoice/                    — Invoice module (original + "2.0" variant)
        ├── notification/               — Customer Notification module
        ├── sales-module/               — Sales Module's generic bell/inbox Notification page
        ├── livetracking/               — Live Tracking module (5 page variants)
        └── testing/                    — Scratch/sandbox page, not linked from sidebar
```

---

## 4. Architecture

### 4.1 Routing — no router library

There is **no `react-router` or equivalent**. `src/App.tsx` defines a discriminated union type covering every page in the app:

```ts
export type AppPage =
  | { type: 'listing' }
  | { type: 'detail'; contractId: string }
  | { type: 'edit-basic'; contractId: string }
  | { type: 'edit-price'; contractId: string }
  | { type: 'edit-group'; contractId: string }
  | { type: 'live-tracking' }
  | { type: 'live-tracking-legacy' }
  | { type: 'live-tracking-testing' }
  | { type: 'live-tracking-testing-2' }
  | { type: 'tracking-2' }
  | { type: 'testing' }
  | { type: 'invoice' }
  | { type: 'invoice-detail'; invoiceId: string }
  | { type: 'invoice-testing-2' }
  | { type: 'invoice-detail-testing-2'; invoiceId: string }
  | { type: 'notification' }
  | { type: 'customer-notification' }
  | { type: 'customer-notification-detail'; notificationId: string }
```

`App()` holds `const [page, setPage] = useState<AppPage>(...)` and a `navigate = (p: AppPage) => setPage(p)` function passed down to any component that needs to trigger navigation. The component body is a **long if-chain**:

```tsx
if (page.type === 'detail') return <ContractDetailPage contractId={page.contractId} ... />
if (page.type === 'invoice-detail') return <AppLayout ...><InvoiceDetailPage .../></AppLayout>
// ...repeated for every page type, falling through to the listing page by default
```

**Important quirks to know:**
- The app **boots directly into `live-tracking-testing-2`** (the Live Tracking "Testing 2" page), not the contracts listing. This reflects that page's status as the current focus of active iteration — not necessarily what a "real" product entry point would be.
- Four contract-related page types (`detail`, `edit-basic`, `edit-price`, `edit-group`) render **without** the shared `AppLayout` — they use their own dedicated `EditPageLayout` (or a custom shell) instead. Every other page type is wrapped in `<AppLayout>`.
- Some pages need to communicate UI state (e.g. "I'm in a multi-select mode") back up to `App.tsx` so it can change what's rendered in `AppLayout`'s top bar. This is done via callback props (e.g. `onSelectModeChange`) — see `notification/CustomerNotificationDetailPage.tsx` and how `App.tsx` uses `notifSelectModeActive` to conditionally hide the "Return to Listing" button. This is a workaround for the fact that the button lives in the layout (owned by `App.tsx`) while the mode that should hide it lives inside the page component several levels down.

### 4.2 Layout — `AppLayout.tsx`

Single shared page chrome (`src/components/layout/AppLayout.tsx`) built from AntD's `Layout` (`Sider` + `Content`):

```ts
interface AppLayoutProps {
  children: React.ReactNode
  activeKey?: string           // default: 'live-tracking-testing-2'
  breadcrumbLabel?: string     // default: 'Live Tracking 2.0'
  breadcrumbItems?: string[]   // overrides breadcrumbLabel with a multi-level breadcrumb
  topBarRight?: React.ReactNode
  onNavigate?: (page: AppPage) => void
}
```

- **Sidebar**: fixed position, **250px wide** (80px collapsed — `Content`'s `marginLeft` is manually kept in sync with the collapse state). Contains a static brand block ("Company" logo), a static hardcoded user block (avatar "HE" / "Heikke Ekkieh" — there is no real auth), and a single collapsible nav section called **"Sales Module"**. This section is a hand-built collapsible group (local `salesOpen` state + chevron icon), **not** AntD's native `Menu.SubMenu`. Its child items are flat `{ key, label, onClick }` objects that call `onNavigate`.
  - Current sidebar entries: **Live Tracking 2.0**, **Invoice**, **Invoice 2.0**, **Customer Notification**.
  - **Not in the sidebar** (only reachable via the app's initial boot state, in-page navigation, or a direct code change): Customer Contracts listing, Live Tracking (original/legacy/testing variants), Tracking 2.0, the Testing sandbox page, and the Sales Module's bell/inbox Notification page.
- **Top bar**: sticky, 48px tall, `#f5f5f5` background, no border. Left side renders a plain-text breadcrumb (not AntD's `Breadcrumb` component) built from `breadcrumbItems` (joined with `" / "`) or falling back to `/ {breadcrumbLabel}`. Right side renders `topBarRight` if provided, else the app version number.
- **Content**: `background: '#f5f5f5'`, no padding — every page manages its own inner padding (typically `padding: 24`).

### 4.3 Theming

`src/main.tsx` wraps `<App />` in AntD's `<ConfigProvider>` with a single global theme object: `colorPrimary: '#1677ff'`, `borderRadius: 6`, a system font stack, plus component-level token overrides for `Table` (header styling) and `Menu` (item height). **This is the one place to change global look-and-feel** — avoid overriding these values ad hoc per-component unless there's a specific reason.

### 4.4 No shared state management

There is no Redux/Zustand/Context-based global store. Data flows are:
- **Mock datasets** are plain exported `const` arrays (e.g. `export const INVOICES: Invoice[] = [...]`) living in per-module `*Data.ts` files. Any component can `import { INVOICES } from './invoiceData'` directly.
- **"Writes"** happen by either (a) local component `useState` that only affects that component's own render, or (b) directly mutating the object inside the shared array (since JS array elements are just object references) so that other components reading the same array later see the change. See `notification/CustomerNotificationDetailPage.tsx`'s `useEffect` that does `notification.trips = trips` to keep the listing page in sync — this pattern is used **specifically because there's no shared store**, and other modules that don't do this (e.g. Invoice) will exhibit the same "listing page goes stale after a detail-page edit" bug unless the same fix is applied there too.

---

## 5. Module & File Conventions

Every feature module under `src/components/<module>/` follows the same rough shape:

| File pattern | Purpose |
|---|---|
| `<Module>Page.tsx` | Main listing page (table, filters, KPI cards, links to detail) |
| `<Module>DetailPage.tsx` | Full-page detail view for a single record |
| `<module>Data.ts` | Shared TypeScript types + the mock dataset array for this module |
| `<module>StatusLogic.tsx` | Pure functions + badge components for status coloring, aggregation, and action enable/disable rules — kept separate from data so it can be unit-testable in principle and reused by both list and detail pages |
| Flat modal/subcomponent files | e.g. `LogPaymentModal.tsx`, `SendEmailModal.tsx` — live directly in the module folder, not in a further `components/` subfolder |

### The "original" vs "2.0"/"testing" pattern

Several modules have **multiple parallel implementations of the same page** — an "original" and a "2.0" or "testing" variant. This is a deliberate pattern in this codebase for iterating on a redesign **without breaking the version currently being demoed**:

- **Never delete or silently overwrite an "original" page when asked to change the "2.0" version, or vice versa** — they are intentionally kept side by side. Only touch the file(s) actually referenced by the current task.
- When a shared PRD/business-logic fix applies to both (e.g. a status computation bug), you generally need to **apply the fix to both files** since they don't share the affected logic in exactly the same way (the "2.0" variant may already have extracted the logic into a shared `*StatusLogic.tsx` file while the original still inlines its own copy — check before assuming they're wired together).
- The Live Tracking module carries this pattern the furthest, with **five** parallel page variants (see §6.4) — always confirm exactly which one is meant before editing.

---

## 6. Module-by-Module Reference

### 6.1 Customer Contracts (`src/components/contracts/`)

The original/primary contracts module (not marked "testing"). Not currently linked in the sidebar (reachable only via the `listing` page type, which is the fallback route).

| File | Role |
|---|---|
| `CustomerContractsPage.tsx` | Listing page: searchable/filterable table, KPI stat cards, row-selection "grouping" flow (select rows → `CreateGroupModal`), opens `ContractDrawer` on row click. |
| `ContractDrawer.tsx` | Slide-out quick-view drawer: summary + price/change history tables + void/edit-payment/join-group actions. |
| `ContractDetailPage.tsx` | Full-page detail view (own header, no `AppLayout`), tabs: Basic Information, Customer Details, Trips, Other Charges, Payment Details. |
| `CreateGroupModal.tsx` | Form modal to create a new contract group from selected rows. |
| `JoinGroupModal.tsx` | Modal to join an existing group (mock success only). |
| `EditPaymentDetailsModal.tsx` | Edit invoice generation date, invoice date, payment terms. |
| `VoidContractModal.tsx` | Confirmation modal requiring a reason before voiding. |
| `StatCard.tsx` | Reusable KPI tile (number + label + filter link). |
| `edit/EditPageLayout.tsx` | Own layout shell (separate from `AppLayout`) used by the three edit sub-pages below. |
| `edit/EditBasicInformationPage.tsx` | Edit customer/contract/PIC/billing info. |
| `edit/EditPricePage.tsx` | Edit trip prices, other-charge prices, discounts/surcharges. |
| `edit/EditGroupPage.tsx` | Edit group membership/settings. |

Shared data: `src/types/contract.ts` (the `Contract`/`Trip`/`OtherCharge` domain model — also reused conceptually by the Invoice module's contract line items) and `src/data/mockData.ts` (`mockContracts: Contract[]`, with comments marking specific customer-code clusters that intentionally trigger specific validation scenarios for demo purposes).

### 6.2 Invoice (`src/components/invoice/`)

Has an **original** and a **"2.0"** page pair.

| File | Role |
|---|---|
| `InvoicePage.tsx` | Original listing page. Has its own **inline, duplicate** `StatusBadge`/status-color logic (not shared with `invoiceStatusLogic.tsx`). |
| `InvoiceDetailPage.tsx` | Original detail page — trips/other-charges/adjustments/payments breakdown, `LogPaymentModal`. |
| `InvoiceTesting2Page.tsx` | "2.0" listing page — imports the **shared** `invoiceStatusLogic.tsx` badge/logic, adds `canMarkAsSent`/`canLogPayment` gating with disabled-button tooltips. |
| `InvoiceDetailTesting2Page.tsx` | "2.0" detail page — same shared logic, plus prev/next pagination between invoices. |
| `LogPaymentModal.tsx` | Shared by both original and 2.0 — record a payment (amount/method/bank/date/ref) against an invoice. |
| `invoiceData.ts` | Shared types (`InvoiceStatus`, `SourceContract`, `AdjustmentRecord`, `PaymentRecord`, `TripRecord`, `OtherChargeRecord`, `ContractLineItem`, `Invoice`) and the `INVOICES` mock array. Also defines `invoiceType: 'individual' | 'group'` — individual invoices show Contract No. as read-only text, group invoices get a working dropdown that switches the displayed trips/charges/summary between multiple real linked contracts. |
| `invoiceStatusLogic.tsx` | Shared pure logic + `StatusBadge`: `computeStatusFromBalance`, `canMarkAsSent`, `canAddAdjustment`, `canLogPayment`, `canEmailInvoice`, tooltip generators. **Only consumed by the "2.0" pages** — the original pages inline their own simpler copy. |

**Known gap**: "Add Adjustment" and "Attach Purchase Order" only exist as menu items in the Actions dropdown on both invoice detail pages — clicking them does not yet open a real modal/flow. See the handoff doc (`CLAUDE_SESSION_CONTEXT.md`) for what was scoped but never built.

### 6.3 Customer Notification (`src/components/notification/`)

Single implementation (no "2.0"/testing variant), built to structurally mirror the Invoice "2.0" pages (same card layout pattern, same tab bar treatment, same sticky positioning) per explicit instruction when this module was created.

| File | Role |
|---|---|
| `CustomerNotificationPage.tsx` | Listing page — contracts needing trip notifications sent, with contract-status/notification-status filters and clickable KPI cards that act as quick filters. |
| `CustomerNotificationDetailPage.tsx` | Detail page — tabs (Basic Information / Trips in Daily Schedule / Additional Information), per-trip notification status, three multi-select modes (Email, SMS, Mark as Not Required), each hiding the normal Actions/Send buttons and (via a callback up to `App.tsx`) the "Return to Listing" button. |
| `EditRecipientsModal.tsx` | Edit phone numbers / emails / CC emails for the contract's notifications, with a mocked "suggested contacts" autocomplete pool. |
| `SendEmailModal.tsx` | Compose + "send" (mock) an email to selected trips; auto-fills subject/content based on trip data; uses `RichTextEditor`. |
| `SendSMSModal.tsx` | Compose + "send" (mock) an SMS for a single selected trip; auto-fills a template with real driver/vehicle/date/time. |
| `SendFeedbackModal.tsx` | Loading → success (or partial-failure) feedback modal shown after a send action. |
| `RichTextEditor.tsx` | Minimal custom `contentEditable`-based rich text editor (bold/italic/underline/strikethrough/lists/link) — no external editor library was added. |
| `StatusSwitcher.tsx` | A **draggable floating demo/debug widget** rendered on the detail page — lets a presenter directly force any trip's notification status (or a whole contract-level status preset that maps to a representative trip pattern) to demo the status-aggregation logic without driving the real send flows each time. This is explicitly a demo-only tool, not a PRD-specified feature. |
| `notificationData.ts` | Shared types (`NotificationStatus`, `TripNotificationStatus`, `TripNotification`, `CustomerNotification`) and the `NOTIFICATIONS` mock array. |
| `notificationStatusLogic.tsx` | Shared pure logic + badges: `ContractStatusBadge`, `NotificationStatusBadge`, `TripStatusBadge`, `computeContractNotificationStatus` (aggregation rule), `canMarkAsNotRequired`, `canSendNotification`, `syncTripAssignment` (keeps driver/vehicle fields consistent with trip status for the demo tool). |

**Known gap**: "View Send History" is referenced in the row action menu and in the PRD's required post-action side effects, but no actual Send History feature (data model or drawer UI) has been built yet.

See `CLAUDE_SESSION_CONTEXT.md` for the full PRD-derived business rules (status aggregation table, action enable/disable matrix, etc.) — that level of detail belongs there, not in this developer-facing structural guide.

### 6.4 Live Tracking (`src/components/livetracking/`)

By far the largest and most actively iterated module — **treat with extra caution**, see the explicit warning below.

| File | Role |
|---|---|
| `LiveTrackingPage.tsx` | Current "main" page. Google Maps-based, with a built-in switchable "Test Console" (map theme, marker style, card style, KPI bar, filters, traffic layer, drawer detail view) for trying different display options live in one page. |
| `LiveTrackingLegacyPage.tsx` | **A frozen backup snapshot.** The file's own header comment states it should not be modified except when explicitly asked to update the legacy copy specifically. |
| `LiveTrackingTestingPage.tsx` | A deliberately simplified, opinionated redesign following `docs/live-tracking-ux-audit.md` — one fixed card/marker design (no switchers), counts-as-filters KPI bar, single vertical list with urgent trips pinned at top. |
| `LiveTrackingTesting2Page.tsx` | **The largest file in the app (~4,700 lines).** A "list-first" redesign (list ~70% width / map ~30% context strip) that reintroduces every display-variant switcher from the main page plus many additional experimental variants (multiple header/highlight styles, claim-CTA styles, urgency-signal treatments). **This is the page the app boots into by default.** |
| `Tracking2Page.tsx` | A separate exploration using **Leaflet** instead of Google Maps — the only page in the app using Leaflet. Different driver-card UI and KPI chip strip. |
| `dummyLiveData.ts` | Mock data generators (`DummyStop`, `dummyPos`, `makeDummyStops`) for the main and Testing 2 pages. |
| `trackingData.ts` | Shared base types/constants/pure helpers (`TripStatus`, `TripPoint`, `VehicleStop`, `deriveStatus`, `toMinutes`, `pointAlong`, map defaults) — the file's own header comment describes it as the single source of truth to keep Live Tracking and Tracking 2.0 in sync. |

> **Standing instruction from earlier in this project's history: do not modify Live Tracking files unless explicitly asked to.** This module is owned by a separate, active design-exploration workflow; changes here are easy to conflict with in-progress iteration happening outside of a given session.

### 6.5 Sales Module Notification (`src/components/sales-module/NotificationPage.tsx`)

A **generic bell/inbox-style system notification center** (invoice/payment/overdue/system/alert types, read/unread state, tabs). Despite the similar name, this is **unrelated in purpose** to `notification/CustomerNotificationPage.tsx` (the customer trip-notification workflow) — don't confuse the two when a task mentions "notification." Not wired into the sidebar; reachable only via `AppPage.type === 'notification'`.

### 6.6 Testing sandbox (`src/components/testing/TestingPage.tsx`)

A scratch page building a mock "recipients" form (PIC phone numbers, manual phone rows with country code, PIC/CC emails, manual email rows). Appears to be an early prototype for what became `notification/EditRecipientsModal.tsx` (near-identical mock data shape). Not linked in the sidebar; safe to ignore unless a task specifically references it.

---

## 7. Known Limitations

- **No backend / no persistence** — every "save" is a React state update that vanishes on refresh. Where cross-page consistency matters (e.g. a detail-page edit needing to show up on the listing page), the pattern is to mutate the shared mock data object in place via a `useEffect` (see §4.4) — this must be done explicitly per module; it is not automatic.
- **No authentication** — the sidebar shows a static hardcoded user ("Heikke Ekkieh").
- **No automated tests** — `playwright` is a dependency but there is no test suite wired up; it's used ad hoc (temporary throwaway scripts, deleted after use) to visually verify UI changes during development. See §8.
- **No CI/CD** — no GitHub Actions or similar pipeline configured.
- **No ESLint/Prettier** — `tsconfig.json` even has `noUnusedLocals`/`noUnusedParameters` disabled, consistent with a rapid-prototyping codebase. Don't assume lint will catch dead code or unused imports — check manually.
- **Duplicated logic across original/2.0 page pairs** in some modules (see §5) — a fix in one does not automatically apply to the other.

---

## 8. Development & Verification Workflow

Because there's no test suite, UI changes in this repo are verified manually via a live browser check. The established workflow (used consistently throughout this project's history) is:

1. **Typecheck**: `npx tsc --noEmit` — must be clean before moving on.
2. **Start a dev server on a scratch port** (to avoid clashing with any server the user might have running): `nohup npm run dev -- --port <N> > /tmp/vite-dev<N>.log 2>&1 &`, then `disown`.
3. **Write a small throwaway Playwright script** (e.g. `verify-<feature>-tmp.mjs` in the repo root) using `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })` (the pre-installed browser path in this environment — do not run `playwright install`), navigate to the relevant page, drive the interaction under test, and take screenshots at each meaningful step.
4. **Read the screenshots** and visually compare against the expected result (a reference screenshot, a PRD description, or prior known-good state).
5. **Clean up**: delete the throwaway `.mjs` script and kill the scratch dev server (`pkill -f "vite --port <N>"`) once verification is done.
6. **Commit and push** the verified change with a descriptive commit message explaining the *why*, not just the *what*.

This workflow exists specifically because claims of "done" without a live visual check have repeatedly turned out to be wrong in this project's history (subtle layout bugs, z-index issues, stale state, etc. that only show up at runtime) — always verify live before reporting a UI change as complete.

---

## 9. Adding a New Module

Follow the established convention (§5) precisely:

1. Create `src/components/<module>/`.
2. Add `<module>Data.ts` with your TypeScript types and a mock dataset array.
3. Add `<module>StatusLogic.tsx` (if the module has any status/badge concept) with pure functions + badge components, kept separate from the data file.
4. Add `<Module>Page.tsx` (listing) and, if needed, `<Module>DetailPage.tsx` (detail view), following the visual pattern of an existing "2.0"-style page (bare title + separate sticky tab card + per-section white rounded cards with dividers between field rows — see `invoice/InvoiceDetailPage.tsx` or `notification/CustomerNotificationDetailPage.tsx` for the current reference implementation of this pattern).
5. Add any modals as flat sibling files in the same folder.
6. Register new page types in the `AppPage` union in `src/App.tsx`, add the corresponding `if (page.type === ...)` branch (wrapped in `<AppLayout>` unless there's a specific reason not to), and add a sidebar entry in `AppLayout.tsx` if the module should be user-navigable.
7. Follow the verification workflow in §8 before considering any change complete.

---

## 10. Path Aliases

The `@/` import alias (e.g. `import type { AppPage } from '@/App'`) resolves to `src/`. It is defined in **two places that must be kept in sync**:

```ts
// vite.config.ts — controls actual bundling/dev-server resolution
resolve: { alias: { '@': resolve(__dirname, './src') } }
```

```json
// tsconfig.json — controls the TypeScript type-checker/IDE only, no effect on the real build
{ "baseUrl": ".", "paths": { "@/*": ["src/*"] } }
```

Convention in this codebase: use `@/...` for cross-cutting imports (`@/App`, `@/types/contract`, `@/data/mockData`, `@/components/common/StatusBadge`) and relative paths (`./invoiceData`, `./EditPageLayout`) for same-folder/sibling imports within a module.
