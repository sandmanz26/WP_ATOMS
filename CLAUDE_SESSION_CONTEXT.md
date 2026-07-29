# Full Project Context & Handoff Notes for Claude

**Purpose of this document**: If you are a fresh Claude session picking up this repository for the first time, read this document in full before making any changes. It contains everything that isn't obvious from reading the code alone: the business rules behind each module (derived from PRDs that may no longer be accessible to you), the working conventions established across many prior sessions, bugs that were found and fixed (and the *patterns* behind them, so you can recognize similar bugs elsewhere), and what's still missing. Read `DEVELOPER_GUIDE.md` first for the structural/technical map — this document assumes you've already read that and focuses on everything else.

---

## Table of Contents

1. [How To Work In This Repo](#1-how-to-work-in-this-repo)
2. [Invoice Module — Business Logic](#2-invoice-module--business-logic)
3. [Customer Notification Module — Business Logic](#3-customer-notification-module--business-logic)
4. [Bug Patterns Found & Fixed (Watch For These Elsewhere)](#4-bug-patterns-found--fixed-watch-for-these-elsewhere)
5. [Pending / Not-Yet-Built Features](#5-pending--not-yet-built-features)
6. [HR Employees Module (MOVE-3409) — PRD Summary, Not Yet Started](#6-hr-employees-module-move-3409--prd-summary-not-yet-started)
7. [Copy / Text Conventions](#7-copy--text-conventions)
8. [Visual Layout Conventions (the "2.0" card pattern)](#8-visual-layout-conventions-the-20-card-pattern)

---

## 1. How To Work In This Repo

This section is the single most important part of this document. The technical architecture is easy to re-derive by reading code; these working conventions are not, and violating them has repeatedly caused rework in this project's history.

### 1.1 Communication
- The user communicates primarily in **Bahasa Indonesia**, occasionally mixing in English technical terms or asking for English output specifically (e.g. when a message needs to be forwarded to someone else). Respond in the same language the user used for their message.
- Keep responses concise and focused on what changed and what's next — avoid long preambles or restating the task back to the user.

### 1.2 The verification workflow is mandatory, not optional
Every UI change must be verified with a **live browser check** before being reported as done:
1. `npx tsc --noEmit` — must be clean.
2. Start a dev server on a scratch port: `nohup npm run dev -- --port <N> > /tmp/vite-dev<N>.log 2>&1 &` then `disown`.
3. Write a throwaway Playwright script (`verify-<feature>-tmp.mjs` in repo root) using `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })` — this exact executable path is required in this environment; do **not** run `playwright install`.
4. Drive the actual interaction (clicks, form fills, navigation) and screenshot at each meaningful state.
5. **Read the screenshots yourself and actually look at them** before claiming success — several bugs in this project's history (z-index issues, stale state, column overlap, cramped modals) were only visible in an actual rendered screenshot, not in the code.
6. Delete the throwaway script and kill the scratch dev server (`pkill -f "vite --port <N>"`) once done.
7. Commit and push with a descriptive message (the *why*, not just the *what*).

**Do not report a task as complete based on code review alone.** This codebase has a long history of subtle runtime-only bugs (see §4) that pure code-reading missed.

### 1.3 Never touch Live Tracking files unless explicitly asked
`src/components/livetracking/*` is owned by a separate, actively-iterating design exploration outside the scope of most tasks in this repo. Even if a task seems tangentially related (e.g. a shared layout pattern), do not modify these files unless the user's request specifically names Live Tracking.

### 1.4 Match reference screenshots literally, including placeholder text
When the user shares a reference screenshot (from Figma, a real running reference app, or elsewhere) and says to match it, match it **exactly** — including cases where the screenshot itself shows a literal placeholder string like `{{refer to copy master list}}` instead of real copy. In that case, reproduce the placeholder text literally in the code rather than inventing real copy. This has come up repeatedly for confirmation-modal bodies (e.g. the Invoice "Mark as Sent" modal and the Notification "Mark as Not Required" modal both intentionally show `{{refer to copy master list}}` as their body text — this is correct, not a bug, unless a copy master list is provided later).

Titles, however, are sometimes real text even when the body is a placeholder — check each field independently against the reference rather than assuming "if one field is a placeholder, they all are." (This exact mistake was made once: the Mark as Not Required modal's *title* should have read "Confirm Notification Not Required" as real text, not `{{refer to copy master list}}` — only the body was meant to stay a placeholder.)

### 1.5 Prefer PRD-derived logic over guessing
When a PRD document is available (uploaded by the user, readable via the `Read` tool from `/root/.claude/uploads/<session-id>/...`), treat it as the source of truth for business logic — status transition rules, field visibility conditions, enable/disable rules, validation messages. Screenshots are the source of truth for **visual layout and exact copy**. When the two conflict, the most recent and most detailed source generally wins, but always re-derive the actual rule rather than pattern-matching against what "looks similar" in an already-built module.

**Important caveat for a fresh session**: PRD files live under `/root/.claude/uploads/<session-id>/` and are **tied to the session that received the upload** — a new session will not have filesystem access to PRDs uploaded in a previous session, even though this repo's history was built from them. Where a module's business logic came from a PRD that is no longer accessible to you, this document (§2, §3, §6) captures the essential rules directly so you don't need the original file. If you need to verify a detail not covered here, ask the user to re-share the relevant PRD rather than guessing.

### 1.6 When genuinely ambiguous, ask — don't guess repeatedly
If a request is ambiguous enough that two reasonable interpretations would produce different code, and getting it wrong would mean redoing work, ask a clarifying question (or send the user your current screenshot and ask them to point at what's still wrong) rather than guessing multiple times in a row. This project's history includes a few rounds of wrong guesses on ambiguous layout requests that could have been resolved with one clarifying question — don't repeat that pattern.

### 1.7 Don't over-engineer
No new npm dependencies unless explicitly asked (e.g. the rich text editor in the Notification module is a hand-built `contentEditable` component specifically to avoid adding a library). No speculative abstractions, no unrequested refactors alongside a bug fix, no backwards-compatibility shims (there are no external consumers of this code). Default to no code comments; only add one where the *why* is genuinely non-obvious.

### 1.8 Commit discipline
Only commit when the user has asked (directly, or implicitly via the standing pattern of "verify then commit" established in this project). Create new commits rather than amending. Never force-push. Never touch `.env` or anything that looks like a secret.

---

## 2. Invoice Module — Business Logic

Source: PRD "WLA Accounting — Invoices Module" (MOVE-2398), plus a follow-up "Actions & Status Matrix" addendum, plus a v3 update that added Contract No. group/individual behavior. These files are not guaranteed to still be accessible to you — the rules below are the distilled result.

### 2.1 Invoice Number Format
```
INV-{YYYY}-{MM}-{NNNN}
YYYY = billing year, MM = zero-padded billing month, NNNN = zero-padded sequential number per month (resets to 0001 each month)
```
(Note: the actual mock data in `invoiceData.ts` uses a different display format like `ATA-2026-0015` / `WTA-2026-0012` — treat the PRD's `INV-...` format as the canonical spec for *new* invoice numbers if that ever needs generating; the existing mock IDs are historical and don't need to be renamed.)

### 2.2 Invoice Status State Machine

States: `Draft`, `Open`, `Overdue`, `Paid`, `Partially Paid`, `Void`.

| From | Trigger | Condition | To |
|---|---|---|---|
| Draft | Mark as Sent | — | Open |
| Draft | Group Contracts | Invoice not Paid/Partially Paid | Void |
| Open | Log Payment (full) | Outstanding = 0 | Paid |
| Open | Log Payment (partial) | Outstanding > 0, before due date | Partially Paid |
| Open | Due date passes | Outstanding > 0 | Overdue |
| Open | Add Adjustment | Outstanding = 0 | Paid |
| Open | Group Contracts | — | Void |
| Partially Paid | Log Payment (full) | Outstanding = 0 | Paid |
| Partially Paid | Due date passes | Outstanding > 0 | Overdue |
| Partially Paid | Add Adjustment | Outstanding = 0 | Paid |
| Overdue | Log Payment (full) | Outstanding = 0 | Paid |
| Overdue | Log Payment (partial) | Outstanding > 0 | Overdue (unchanged) |
| Overdue | Add Adjustment | Outstanding = 0 | Paid |
| Overdue | Group Contracts | — | Void |
| Paid / Void | — | Terminal, no outgoing transitions | — |

Precedence rules: **Paid** overrides Overdue if outstanding reaches 0 after a payment. **Draft** invoices never become Overdue regardless of due date. **Void** is always terminal.

This is implemented in `invoiceStatusLogic.tsx` as `computeStatusFromBalance(grandTotal, outstandingBalance, dueDate, today)`.

### 2.3 Master Action-per-Status Matrix

| Action | Draft | Open | Partially Paid | Overdue | Paid | Void |
|---|---|---|---|---|---|---|
| Mark as Sent | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Add Adjustment | ✅ | ✅ | ✅ | ✅ | ❌ (tooltip: "Adjustment cannot be added to a fully paid invoice") | ❌ (tooltip: "This invoice has been voided") |
| Log Payment | ❌ | ✅ | ✅ | ✅ | ❌ (tooltip: "This invoice has been fully paid") | ❌ (tooltip: "This invoice has been voided") |
| Email Invoice | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ (tooltip: "This invoice has been voided") |
| Download Invoice | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (tooltip: "This invoice has been voided") |
| Attach PO | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ (tooltip: "This invoice has been voided") |
| View Change History | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Contract No. dropdown | Group invoices only, at any status | | | | | |

Implemented as `canMarkAsSent`, `canAddAdjustment`, `canLogPayment`, `canEmailInvoice` in `invoiceStatusLogic.tsx` (only some of these are actually wired into UI yet — see §5).

### 2.4 Add Adjustment

- Modal fields: Adjustment Type (tabs: "Deduct Payment" / "Additional Payment"), Reason for Adjustment (text, required, max 120 chars), Amount (auto-prefixed `-` or `+` based on type, required, > 0, 2 decimal places).
- On save: adjustments table updated, invoice `Grand Total` recalculated (`Trips Subtotal + Other Charges Subtotal + Adjustments Subtotal`), status re-evaluated per the matrix below, change history entry logged (`editType: "Add Adjustment"`, before/after adjustments subtotal).

Status update matrix after saving an adjustment:

| Original Status | Outstanding After Adjustment | Due Date | New Status |
|---|---|---|---|
| Draft | any | any | Draft (unchanged) |
| Open / Overdue | Grand Total = Outstanding | before due date | Open |
| Open / Overdue | Grand Total = Outstanding | on/after due date | Overdue |
| Open / Overdue | Grand Total > Outstanding > 0 | before due date | Partially Paid |
| Open / Overdue | Grand Total > Outstanding > 0 | on/after due date | Overdue |
| Open / Overdue | Outstanding = 0 | any | Paid |
| Partially Paid | Grand Total > Outstanding > 0 | before due date | Partially Paid |
| Partially Paid | Grand Total > Outstanding > 0 | on/after due date | Overdue |
| Partially Paid | Outstanding = 0 | any | Paid |

**This entire flow (modal + wiring) has not been built yet** — see §5.

### 2.5 Contract No. — Individual vs Group Invoices (this one IS built)

An invoice can be `invoiceType: 'individual'` (linked to exactly one contract) or `invoiceType: 'group'` (linked to 2+ real contracts, each with its own trips/other-charges/discount/surcharge). This is a field on the `Invoice` type in `invoiceData.ts`.

- **Individual invoices**: Contract No. is displayed as **plain, non-interactive text** with a tooltip reading *"This invoice is linked to a single contract"*. No dropdown at all.
- **Group invoices**: Contract No. is a **working `Select` dropdown**. Switching it re-filters/recomputes the Trips table, Other Charges table, and the Contract Price Summary (Sub Total / Discount / Surcharge / Total) to the selected contract's own data. The invoice header (No., Status, Due Date) does **not** change when switching — only the contract-scoped sections below it.
- In the current mock data, `ATA-2026-0015` (id `'1'`) is the one group invoice, with 5 real linked contracts each carrying genuinely different trip/charge data (via a `buildContract(...)` helper in `invoiceData.ts` that computes subtotals from real line items, as opposed to the older `makeContractDetail(...)` helper which reuses one shared canned dataset for simple individual-invoice contracts). All other mock invoices are `individual`.
- **Do not fabricate dummy contract numbers to pad out a dropdown** — an earlier version of this code added fake extra contract-number options to make the dropdown "look richer," which was wrong per the PRD and was reverted. If a dropdown needs more real options, add real `ContractLineItem` entries with distinct data instead.

This logic is implemented in both `InvoiceDetailPage.tsx` and `InvoiceDetailTesting2Page.tsx` (duplicated — see the "original vs 2.0" note in `DEVELOPER_GUIDE.md` §5).

---

## 3. Customer Notification Module — Business Logic

Source: PRD "Customer Notification Module — Comprehensive PRD for Vibe Coding" (Epic MOVE-136). Distilled in full below since this is the module with the deepest, most precisely-specified business logic in the repo.

### 3.1 Data Architecture

```
QUOTATION (Ad-hoc Booking, confirmed) → auto-creates → CUSTOMER NOTIFICATION RECORD (1 per contract)
    has a contract-level notification status (always aggregated, never stored — see §3.3)
    has basic information (recipients: mobile numbers, emails, email CC)
    └── TRIPS IN DAILY SCHEDULE (1 row per trip-day)
            each has its own trip-level notification status
```
1 contract → many trips. Example: a contract with Trip A (daily, 1–3 Jul) + Trip B (daily, 1–3 Jul) = 6 trip rows total in the daily schedule.

### 3.2 Trip Notification Status (`TripNotificationStatus`)

| Status | Meaning | Set When |
|---|---|---|
| `Pending Assignment` | No driver AND/OR no vehicle assigned | Default on auto-create |
| `Ready to Sent` *(sic — PRD spells it "ready to send," codebase uses "Ready to Sent" as the literal enum value)* | Driver AND vehicle both assigned, never sent | Auto-set when driver+vehicle first assigned, from Pending Assignment |
| `Sent` | Email or SMS successfully sent | After a successful send action |
| `Resend Required` | Driver/vehicle assignment **changed** after the trip was already `Sent` | Auto-set when assignment changes while status = Sent |
| `Not Required` | User manually marked "not required" | After the Mark as Not Required action is confirmed |

**Critical rule — `Not Required` is "sticky"**: it never auto-changes due to driver/vehicle edits (does not revert to Pending Assignment if the driver is removed, does not advance if reassigned). It **only** changes when the user explicitly sends an email or SMS that includes that trip — sending always forces the trip to `Sent`, overriding `Not Required` unconditionally.

### 3.3 Contract Notification Status (`NotificationStatus`) — always computed, never stored

| Status | Rule |
|---|---|
| `Pending Assignment` | ALL trips = `Pending Assignment` |
| `Ready to Send` | ≥1 trip = `Ready to Sent` or `Resend Required`, AND 0 trips = `Sent` |
| `Partially Sent` | ≥1 but NOT all trips = `Sent` or `Not Required` |
| `Completed` | ALL trips = `Sent` or `Not Required` |

Implemented as `computeContractNotificationStatus(trips)` in `notificationStatusLogic.tsx`:
```ts
export function computeContractNotificationStatus(trips) {
  const total = trips.length
  if (total === 0) return 'Pending Assignment'
  const allPending = trips.every(t => t.notificationStatus === 'Pending Assignment')
  if (allPending) return 'Pending Assignment'
  const progressCount = trips.filter(t => t.notificationStatus === 'Sent' || t.notificationStatus === 'Not Required').length
  if (progressCount === total) return 'Completed'
  if (progressCount >= 1) return 'Partially Sent'
  return 'Ready to Send'
}
```
**This must be recalculated on every trip status change** — never read a stored/cached contract-level status field. This was a real bug caught and fixed early in this module's history (an earlier draft stored the field statically, which could drift out of sync as trips changed).

### 3.4 Listing Page (`CustomerNotificationPage.tsx`)

Columns: Contract No., Customer Code, Contract Period, Contract Title (no truncation, wraps to multiple rows), Contract Status (`upcoming`/`active`/`ended`/`voided`), Notification Status (computed), Progress (`X/Y` where X = trips with status `Sent`), Last Updated On.

Search placeholder: exactly `"Search customer notifications"` (lowercase, plural). Filters (all multi-select): Customer Code, Contract Period (date range), Contract Status, Notification Status, Last Updated On (date range).

**Highlight/KPI cards** (§5 of the PRD): "Pending Assignment" and "To Send" counts. Both counts are filtered to `contractStatus IN ['Upcoming', 'Active']` **first**, before counting by notification status — voided/ended contracts never count toward either card. Clicking a card applies it as a quick filter that **overrides** any previously applied filters (not additive).

### 3.5 Details Page Layout & Buttons

Header: Contract No. + Contract Notification Status badge. Buttons: "Return to Listing" (nav), "Actions ▾" dropdown (Edit Recipients, Mark as Not Required), "Send ▾" dropdown (Email, SMS) as the primary CTA.

Tabs: Basic Information | Trips in Daily Schedule | Additional Information.

Trips table columns: Trip Date, Start Time, Driver (`-` if unassigned), Vehicle (`-` if unassigned), Notification Status, Actions (kebab menu: View trip details / Track trip / View send history — the last of these has no real implementation yet, see §5).

### 3.6 Send Email

- Entry: Send ▾ → Email. Enabled when contract status ≠ `Pending Assignment` (disabled + tooltip otherwise).
- Enters a **multi-select mode**: checkboxes appear on trip rows (hidden entirely for `Pending Assignment` rows — not just disabled), "Return to Listing"/"Actions"/"Send" all hidden, replaced by a "{n} schedule(s) selected" counter + "Cancel" + "Preview Email" primary CTA.
- Validation on "Preview Email": if **any** selected trip is `Resend Required`, **all** selected trips must be `Resend Required` (no mixing with other statuses) — otherwise show an error and stay in select mode. Any other mix of `Ready to Sent` / `Sent` / `Not Required` is fine.
- Preview modal ("Send Email Notification"): Email (tags input, defaults from recipients), Email CC (tags input), Subject (auto-filled — see below), Content (rich text, auto-filled default template), read-only "Assigned Trip" table of the selected trips.
  - Default subject: `[{contractNo}] Driver Assigned for Trip(s) on {date1}, {date2}, ...`, or if any selected trip is `Resend Required`: `[{contractNo}] Amendment: Driver Assigned for Trip(s) on {dates}`.
  - Default content: `Dear Customer, / Driver assignment for the following trip(s) have been confirmed. / Should you require any assistance, please contact us at +65 68611187 (ext 0). Thank you! / *Please do not reply to this automated message.*` (last line italic).
- On send: loading → success/partial-failure/timeout feedback modal (see §3.8) → **all** selected trips forced to `Sent` (even if some were `Not Required`) → contract status recalculated → exit select mode.

### 3.7 Send SMS

- Entry: Send ▾ → SMS. Same enable condition as Email.
- **Single-select mode** (radio buttons, not checkboxes) — only 1 trip at a time. Radio hidden for `Pending Assignment` rows.
- No mixing-validation needed (single selection). No Subject field, no Email CC, no rich text — plain content only, and per the PRD, capped at 160 characters with a live counter (this character-limit enforcement is **not yet implemented** in the current `SendSMSModal.tsx` — it uses the same rich text editor as Email for now, which is a known simplification, not a PRD-accurate implementation).
- Default content template resolves real values (driver first name, vehicle plate, trip date, trip start time, a generated tracking URL) rather than leaving literal `[placeholder]` text.
- On send: same loading → feedback → forced-to-`Sent` → recalculate flow as Email.

### 3.8 Mark as Not Required

- Entry: Actions ▾ → Mark as Not Required. Enabled when contract status ≠ `Completed` (disabled + tooltip otherwise).
- Multi-select mode: checkboxes shown **only** for `Pending Assignment` and `Ready to Sent` trips (the opposite eligibility set from Email/SMS — `Sent`, `Resend Required`, and `Not Required` trips are not selectable here). No mixing-validation restriction.
- Primary CTA "Notification Not Required" is disabled while 0 trips are selected.
- Clicking it opens a confirm modal: title **"Confirm Notification Not Required"** (real text), body `{{refer to copy master list}}` (literal placeholder — see §1.4), Confirm / Cancel.
- **Cancelling the confirm modal must also exit multi-select mode entirely**, returning to the normal page state (this was a bug — see §4).
- On confirm: all selected trips → `Not Required`, contract status recalculated, success toast, modal closes, exit select mode.

### 3.9 Feedback Modal (shared by Email & SMS sends)

Three states based on the (simulated) send response:
- **All success**: header "Notification Send Status", body "Customer notification has been sent successfully to all recipients.", single "Return to Details Page" button.
- **Partial failure**: same header, body "Customer notification has been sent successfully, except to the following recipients:" + bulleted list of failed recipients.
- **Timeout** (>10s, per PRD): "The notification send status is currently not available. Please check the send history for updates at a later time." — **this timeout state is not implemented**; the current mock send is a fixed `setTimeout(700ms)` that always "succeeds."

### 3.10 Edit Recipients

Always enabled (no status restriction). Modal fields: Mobile Number, Email, Email CC — all `Select mode="tags"` with a mocked autocomplete suggestion pool (representing "PIC contacts from the Customers module" in a real backend). Saving updates the Basic Information section and becomes the new default for future Send Email/SMS modals — it does **not** write back to any customer master data (there is none in this demo).

### 3.11 Auto-Update Rules (driver/vehicle assignment changes elsewhere)

This describes what *should* happen when a trip's driver/vehicle assignment changes via some other part of the system (e.g. a Trips/Daily Schedule module that doesn't exist yet in this repo):

| Trigger | Current Status | → New Status |
|---|---|---|
| First assign (driver+vehicle) | Pending Assignment | Ready to Sent |
| First assign | Not Required | Not Required (no change) |
| Change to different driver/vehicle | Ready to Sent | Ready to Sent (no change) |
| Change to different driver/vehicle | Sent | Resend Required |
| Change to different driver/vehicle | Not Required | Not Required (no change) |
| Remove assignment | Sent | Pending Assignment |
| Remove assignment | Resend Required | Pending Assignment |
| Remove assignment | Not Required | Not Required (no change) |

There is no real "assign driver/vehicle" feature wired into this module in the current repo (no Daily Schedule editor exists) — this table exists for reference in case such a feature is ever built here, and to explain why `Not Required` is treated as "protected" everywhere else in the code.

### 3.12 The `StatusSwitcher` demo tool

`notification/StatusSwitcher.tsx` is a floating, draggable panel (not part of any PRD) added specifically so a presenter can force any individual trip's status via a dropdown, or pick a target **contract-level** status from a shortcut dropdown that bulk-applies a representative trip-status pattern satisfying the §3.3 aggregation rule (e.g. picking "Completed" sets every trip to `Sent`). It also keeps driver/vehicle fields consistent with whatever status is chosen (`syncTripAssignment` — auto-fills a demo driver/vehicle pair when a trip moves to any non-`Pending Assignment` status if currently unassigned, and clears them back to `-` when moved to `Pending Assignment`), since a trip showing e.g. `Ready to Sent` with no driver/vehicle would visually contradict its own PRD definition (§3.2).

If you ever need to reproduce this pattern elsewhere (e.g. an Invoice status switcher for demos), follow the same shape: a floating FAB that expands to a draggable panel, `id`'d root element for reliable test automation, and **be careful with z-index** — see the dropdown/panel z-index bug in §4.

---

## 4. Bug Patterns Found & Fixed (Watch For These Elsewhere)

These are real bugs found during this project's development, written up as *patterns* so you can recognize the same shape of bug in code you haven't touched yet.

### 4.1 Stale state captured at first mount, never re-synced on reopen

**Symptom**: A modal's default field value (e.g. an email subject line, or rich text content) is computed from props inside `useState(computeDefault(props))`. Since `useState`'s initializer only runs once — at the component's very first mount — and that first mount happens when the modal is still closed and its trigger data (e.g. "which trips are selected") is still empty, the field silently keeps showing a stale/empty default forever, even though the modal *visually* looks fine on each reopen (because a *different* piece of the UI, like an uncontrolled rich-text `<div>` seeded via its own `useEffect(() => {...}, [])`, happens to re-render correctly while the actual React state backing form submission does not).

**Fix pattern**: sync the state explicitly whenever the modal transitions to open:
```ts
useEffect(() => {
  if (open) {
    setSubject(defaultSubject(contractNo, selectedTrips))
    // ...reset every other derived field here too
  }
}, [open])
```
This was found in both `SendEmailModal.tsx` and `SendSMSModal.tsx` (their subject/content defaulted from `useState` at first mount, before any trip was ever selected) and fixed in both. **Before trusting any modal's "pre-filled from props" field, check whether it's actually re-synced on open, not just seeded once.**

### 4.2 Floating panel z-index higher than dropdown portal z-index

**Symptom**: A custom `position: fixed` floating panel (with a high `zIndex` so it stays above normal page content) contains an AntD `<Select>`. Clicking the select opens its dropdown, but clicking any option inside that dropdown silently fails ("element intercepts pointer events" in Playwright, or nothing happens on a real click) — because AntD's `Select` dropdown renders in a **portal appended to `document.body`** with its own default z-index (~1050), which can be *lower* than your custom floating panel's z-index, so the panel itself sits visually on top of and blocks its own dropdown.

**Fix**: explicitly raise the dropdown's z-index above the panel's: `<Select dropdownStyle={{ zIndex: <panel z-index + 100> }} />`. Apply this to **every** `Select` inside a custom-positioned floating/fixed element, not just the one that happened to be tested.

### 4.3 Local component state not synced back to shared mock data

**Symptom**: A detail page copies its record's nested array into local `useState` (e.g. `const [trips, setTrips] = useState(notification.trips)`) so it can freely mutate it during the session. All the actions on that page (Send Email, Mark as Not Required, a demo Status Switcher, etc.) correctly update this local state and the detail page re-renders correctly. But the **listing page**, which computes its own display columns fresh from the shared mock array on its own mount (`useMemo(() => SHARED_ARRAY.map(...), [])`), never sees any of these changes — because the detail page's local state is a *copy*, not a reference back into the shared array.

**Fix pattern**: mirror local state changes back onto the actual object living inside the shared array, since in this codebase (no real store) array elements are just object references and mutating them in place is enough for a fresh read elsewhere to pick it up:
```ts
useEffect(() => {
  notification.trips = trips   // `notification` is the actual object inside NOTIFICATIONS[], obtained via .find()
}, [trips, notification])
```
This works because navigating away and back to the listing page in this app's routing model causes a **full remount** (see `DEVELOPER_GUIDE.md` §4.1 — routing is just conditional rendering, not a persistent route tree), so the listing's `useMemo(..., [])` naturally recomputes from the now-mutated shared data on next visit. **This fix was applied to the Notification module; the same class of bug likely exists in the Invoice module too (its detail pages also copy data into local state) and has not been checked/fixed there yet.**

### 4.4 Grid/table columns with no explicit `gap` visually merging under narrow widths

**Symptom**: A CSS Grid–based table header (columns defined via `gridTemplateColumns` without a `gap`) renders adjacent short header labels (e.g. "Driver" next to "Vehicle") as visually merged/overlapping text when the column allotted to the wrapping label is too narrow, especially at small modal widths.

**Fix**: always set an explicit `gap` on grid-based table layouts (`gap: 8` was used), and size columns generously enough for their header label and typical content to fit without wrapping — add `whiteSpace: 'nowrap'` (plus `overflow: hidden; textOverflow: ellipsis` on data cells) rather than letting long values wrap unpredictably.

### 4.5 Fabricating placeholder data to "fill out" a UI element

An earlier iteration of the Invoice Contract No. dropdown added fake extra contract-number options purely to make an empty-looking dropdown appear to have more choices, guessing that's what a reference screenshot implied. This was wrong — the actual PRD rule (§2.5 above) was that individual invoices shouldn't show a dropdown *at all*, and group invoices should only ever show their *real* linked contracts. **Don't invent placeholder options/data to make a UI element look fuller — check whether the underlying data model needs a real fix instead.**

---

## 5. Pending / Not-Yet-Built Features

Explicit list of things that are referenced in the UI (menu items, action buttons) or specified in a PRD, but have no real implementation yet:

- **Invoice → Add Adjustment**: modal + full flow described in §2.4 above. Currently just a menu item in the Actions dropdown on both Invoice detail page variants with no `onClick` handler wired to a real modal.
- **Invoice → Attach Purchase Order**: same situation — menu item exists, no modal/flow built.
- **Notification → View Send History**: referenced in the trip row's kebab action menu and required as a side effect of every send/mark-not-required action per the PRD (§3.6–§3.8 above all end with "capture in send history"), but there is no `SendHistory` data model or drawer UI in the codebase at all yet.
- **Notification → SMS 160-character limit**: `SendSMSModal.tsx` currently reuses the same unrestricted rich-text-style content field as Email; the PRD-specified 160-char cap with live counter and error state (§3.7 above) is not enforced.
- **Notification → Timeout feedback state**: `SendFeedbackModal.tsx` supports a partial-failure UI but the "timeout after 10 seconds" state (§3.9) has never been exercised/wired — the mock send always resolves after a fixed 700ms.
- **Invoice module's "listing goes stale after a detail-page edit" bug** (see §4.3): confirmed to exist conceptually, not yet verified or fixed — check `InvoicePage.tsx`/`InvoiceDetailPage.tsx` (and the "2.0" pair) for the same local-state-not-synced-back pattern before assuming they're fine.
- **HR Employees module (MOVE-3409)**: entire module has not been started. See §6 for the full PRD summary if/when this work begins.

---

## 6. HR Employees Module (MOVE-3409) — PRD Summary, Not Yet Started

This module does not exist in the codebase in any form yet (confirmed via full codebase search — no Employee/HR files, routes, or sidebar entries). Two PRD versions were reviewed; this summary reflects the more detailed/later version. If work begins on this module, follow the conventions in `DEVELOPER_GUIDE.md` §5 and §9 (new module scaffolding) exactly, and re-request the original PRD file from the user if deeper field-level detail is needed than what's captured here (many sub-tickets are still marked "To Define Tasks" / blank in the source PRD itself, so some of this is inherently incomplete even at the source).

### 6.1 Key Entities
- **Employee Profile** — personal info, identification, contact, driver profile, payroll, access role.
- **Employee Contract** — employment terms, compensation, working arrangement, termination terms. An employee can have multiple contracts (roles) and contracts can be superseded by addendums (new versions).

### 6.2 Employee Profile Status
`Draft` (created, no active contract) → `Active` (≥1 contract with status On Probation/Confirmed/Ending) → `Suspended` (manual suspend action, effective once the suspension start date passes) → back to `Active` (unsuspend, manual or automatic when the suspension end date passes) → `Inactive` (all contracts end up in a non-active status).

### 6.3 Employee Contract Status
```
Draft → Pending Signature → Accepted → On Probation → Pending Confirmation → Confirmed
                                                                                  │
                                                    ┌─────────────────────────────┤
                                                    ▼ (end action)                 ▼ (addendum created)
                                                  Ending                       Superseded
                                                    │ (effective date passes)
                                        ┌───────────┼───────────┬─────────────┐
                                        ▼           ▼           ▼             ▼
                                    Resigned   Terminated    Retired    Ended (fixed-term lapsed)
```
- `On Probation`: contract start date reached + probation required.
- `Pending Confirmation`: probation end date passed, not yet confirmed.
- `Ending`: an end-of-employment action (resign/terminate/retire) has been submitted with an effective date that hasn't passed yet, OR (per one PRD version) less than 1 month remains before the contract's end date.
- Once an effective date passes, status moves from `Ending` to the specific terminal state (`Resigned`/`Terminated`/`Retired`) or `Ended` for a lapsed fixed-term contract with no explicit end action.

### 6.4 Two-Tier View Permission (new in the later PRD version — important, easy to miss)
- `view employee details (full)` — HR users, see every field of every employee.
- `view employee details (ops)` — Ops users, see only employees where **driver profile required = yes**, and even then with specific fields hidden: Passport (hidden), all Dependants fields (hidden), Basic Salary in the contracts table (shown as `-`), all Work Pass fields (hidden), all Payroll fields (hidden), all Assets & Access fields (hidden). Contact Information and Driver Profile sections are fully visible to ops.

### 6.5 Module Structure (per the navigation flow diagram)
```
Employees Highlights (dashboard, KPIs — spec still TBD in source PRD)
Employees Listing → Create Employee (button) / click row → Employee Profile Drawer
Employee Profile Drawer (quick view) → Edit / Suspend / Unsuspend / View Change History / Create Contract
Employee Profile Details Page (full page) → same actions + full Contracts table → click contract → Contract Details Page
Employee Contract Details Page → Edit / Confirm / End Contract (Resign/Terminate/Retire) / Download / View Change History
```

### 6.6 Listing Page Columns
Full Name, Employment Eligibility, Hiring Company (from the contract with status Accepted/Active/Ending/Superseded; if multiple, show most recent + "+n"), Department, Job Title, Access Role, Employee Status, Last Login (marked "pending verification" in the source PRD — likely not implementable without real auth), Last Updated On (creating/editing a contract or addendum also counts as a profile update for this column).

Filters (all multi-select): Employment Eligibility (Citizen/PR/Work Pass Holder/Work Pass Not Required), Hiring Company (Westpoint Transit/Coach/Tours — hardcoded for now), Department (Digital/Driver/Facilities/Finance/HR/Operations/Sales/Workshop/Not applicable), Access Role (from a Roles & Permissions module that doesn't exist in this repo either), Profile Status. Plus a Last Updated On date range. Search bar placeholder: "Search Employees", searching Full Name + Job Title.

### 6.7 Create Employee Profile — Section Structure (later PRD version, 5 sections)
1. **Personal Information** (sub-sections: Basic Information incl. identification fields, Contact Information, Dependants) — includes uniqueness validation on Identification Number and Work Pass Number, case-insensitive, checked against **all** existing tenant employees including inactive ones.
2. **Work Pass** — conditional on a Yes/No radio; if No, the whole section's fields are hidden (not just disabled).
3. **Driver Profile** — same conditional pattern; includes a Vocational Licence table and an Additional Permits/Certificates table, both with Valid/Expired status tags auto-derived from expiry date vs today.
4. **Payroll** — bank name/account/PayNow type.
5. **Assets & Access** — access role (multi-select from Roles & Permissions), work contact, and a Company Assets table.

"Create" saves with status `Draft` and redirects to listing with a success toast; missing required-for-draft fields blocks with an error toast + field highlighting. Cancel discards everything (same as closing the browser or hitting back).

### 6.8 Create Employee Contract — Section Structure (4 sections)
1. **Employment Details** — hiring company, employment type, contract period (if fixed-term/internship), start date, probation (if required, period + auto-computed end date), job title, department, reporting manager, work location.
2. **Compensation & Benefits** — salary basis/currency, base salary (+ separate probation-period base salary if applicable), optional allowances table, standby/overtime/medical insurance flags, annual/sick leave entitlement (**cross-module note**: annual leave auto-populates a Leave module 3 months after contract start once status = active; sick leave auto-populates immediately once active — neither Leave module exists in this repo).
3. **Working Arrangement** — schedule type, working hours (if Fixed Hours), working days/week, preferred weekend days (only shown if Department = Driver/Operations), remote arrangement (only shown if Work Location = Hybrid).
4. **Termination Terms** — notice period (+ separate probation notice period if applicable).

### 6.9 Contract End Actions (Resign / Terminate / Retire)
All three share the same shape: enabled only when contract status is On Probation/Pending Confirmation/Confirmed; each opens its own confirm modal (title pattern: `"Mark as Resign [Full Name]"` / `"Terminate [Full Name]"` / `"Mark as Retire [Full Name]"`) collecting an effective date (plus a submission date for resign, plus a reason for terminate); result status is `Ending` if the effective date hasn't passed yet, or the terminal status (`Resigned`/`Terminated`/`Retired`) if it has already passed at save time. Each populates an "End of Employment" section on the Contract Details page (End Type, Processed By, relevant dates/reason).

### 6.10 Suspend / Unsuspend
- Suspend modal collects a start date + end date + reason (text area). Result: `Suspended` if the start date has already passed, otherwise stays `Active` ("pending suspension" — the record shows the suspension is scheduled but not yet effective).
- If already suspended, the same entry point instead opens an "Edit Suspension" modal with the same fields pre-filled.
- Unsuspend can be automatic (when the suspension end date passes) or manual (button click, no modal).
- Effect (conceptual — no real auth exists in this repo to actually enforce): suspended users would be logged out and blocked from logging in, but their profile data remains editable by HR.

### 6.11 Open Discussion Points Worth Knowing (unresolved in the source PRD itself)
- Whether "Ending" should also trigger at "<1 month before contract end date" in addition to a pending end-action (inconsistent between the two PRD versions reviewed).
- Whether job scope should be included in the downloadable contract document (pending a named stakeholder's confirmation in the source PRD — not resolvable from the document alone).
- Whether fixed-term contracts should auto-end on expiry or require a manual action.
- "Extend Probation," "Create Addendum," and "Upload Signed Contract" are all referenced as contract actions but have no specification at all beyond their name.
- Download Contract format (PDF vs doc) and both Change History features (Profile and Contract) are explicitly "blank tickets" in the source PRD — don't invent detailed specs for these; treat them as clearly out of scope until further detail is provided.

---

## 7. Copy / Text Conventions

- **`{{refer to copy master list}}`**: a literal placeholder string used verbatim in code wherever a reference screenshot showed this exact text instead of real copy (typically confirm-modal bodies). Do not replace it with invented copy — it means "the product/content team hasn't written the final microcopy yet." If the user later provides a copy master list, replace these placeholders with the real text at that point, not before.
- Toast/message text where no exact copy was specified is written as clear, plain English/Indonesian-neutral sentences describing what happened (e.g. "Notification marked as not required", "Recipients updated") — these are reasonable inventions where the PRD only specified a "copy master list key" without giving literal text, and are fine to keep as-is or refine later.
- Button labels are matched literally to reference screenshots even when semantically unusual — e.g. `EditRecipientsModal.tsx`'s save button is labeled **"Sent"** (not "Save") because that's what the reference screenshot showed.

---

## 8. Visual Layout Conventions (the "2.0" card pattern)

This is the current visual reference pattern for any detail page in this codebase (established through iteration on the Invoice and Notification detail pages — see the visual fixes applied to both `InvoiceDetailPage.tsx`/`InvoiceDetailTesting2Page.tsx` and `CustomerNotificationDetailPage.tsx`):

- **Page title is bare** — no card background, no border, sits directly on the page's light-gray background (`#f5f5f5`). Contains the record's identifier + a status badge on the left, and primary action buttons (Actions dropdown, primary Send/Log Payment button, etc.) on the right.
- **Tab bar is its own separate white rounded card**, positioned below the title with a gap (not glued to the title in one shared card). Tabs are spread evenly across the full card width (`justify-content: space-between`), not packed to the left. The tab card is **sticky** (`position: sticky; top: 48px` — 48px matches `AppLayout`'s top bar height) so it stays visible while scrolling through a long page.
- **Each content section is its own separate white rounded card** (e.g. Basic Information, Billing Details, Invoice Details, Adjustment Details, Payment Received, Additional Information each get their own card with a gap between them) — **not** one continuous card with thin `<Divider>` lines between sections. This was a real bug fixed across multiple detail pages (the old pattern glued every section into one card).
- **Field rows within a card get a divider line beneath each row** (not just grid spacing) — e.g. Basic Information's 3-column field grid has a `<Divider>` after every row of 3 fields, including the last row.
- A "summary"/stats card (e.g. Invoice's Sub Total/Adjustment/GST/Grand Total/Amount Received/Outstanding Balance) sits **beside** the main info card as its own separate card, not stacked inside it. Rows within it also get dividers between them; the "total" rows (Grand Total, Amount Received, Outstanding Balance in the Invoice case) are visually bolded/emphasized while the intermediate line items are plain weight.
- The breadcrumb + "Return to Listing" bar at the very top of the page (owned by `AppLayout`, not the page itself) has **no white background** — it sits directly on the same gray page background with no border underneath it.

When building a new detail page or fixing an existing one, use this pattern as the default unless a specific reference screenshot says otherwise.
