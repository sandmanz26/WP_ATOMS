# Changelog

All notable changes to this repository. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/) (pre-1.0, so new features bump the
minor).

> **Maintenance rule:** every change that ships gets an entry here in the same
> commit that makes the change. Where a change comes from a Jira ticket, cite the
> ticket key; where it comes from review feedback or a judgment call, say so —
> the point is that the *why* survives, not just the *what*.

---

## [Unreleased]

### Changed — Roster 4.0 aligned with the 11 Aug ticket rewrite

MOVE-3608, MOVE-3658, MOVE-3659 and MOVE-3610 were all rewritten on 11 Aug. Two
of the revisions contradicted what was already built.

- **Standby is now an independent assignment** (MOVE-3608). It previously pulled
  an employee out of their shift group onto the Standby bar. The ticket now
  states that adding or removing standby must not change the AM/PM/Off Day
  assignment and that an employee can hold both, so grouping is additive: an
  employee rostered AM and put on standby appears in `AM (n)` *and*
  `Standby (n)`. On Leave stays exclusive. Because the ticket also says
  employees on leave cannot be assigned standby, `resolveDailyStatus` now clears
  the flag on leave rather than leaving it to each caller.
- **Off Day is no longer assignable on a weekday** (MOVE-3658 §3). The edit
  drawer offers AM/PM on weekdays and AM/Off Day on weekends via a shared
  `shiftOptionsForDay` helper. The Create/Edit Roster Rule week grid follows:
  weekdays cycle `AM → PM → AM` (MOVE-3610), with an existing weekday Off Day
  resolving back to AM so older data is never stuck outside the cycle.
- **The edit drawer has its own Save/Cancel** (MOVE-3658 §3). Changes are staged
  in the drawer and only reach the session draft on drawer Save; Cancel or
  closing discards that day. The page-level Save/Cancel still commits or
  discards the whole session across every edited day.
- **Public holidays lock shift editing** (MOVE-3658, revised 15:02). On a public
  holiday the shift control is disabled with Off Day selected, while the standby
  checkbox stays live and does not affect the Off Day assignment. A banner
  explains the state so the disabled control does not read as a bug.
- **Employees are listed A–Z by name** in the details card (MOVE-3659 §2) and the
  edit drawer (MOVE-3658 §3), replacing the status-then-name ordering the
  rewritten tickets no longer ask for.

### Removed

- The "Click a bar to see which staff are in it…" helper line above the Roster
  4.0 calendar, on request. The edit-mode helper line stays, since that mode's
  interaction is not self-evident.

### Fixed

- The floating variant switcher covered the edit drawer's Save button. It now
  sits below AntD's drawer/modal layer (z-index 900 vs 1000).

### Added — floating calendar variant switcher (Roster 4.0)

A draggable, hideable demo panel, following the same pattern as
`notification/StatusSwitcher.tsx`. Not a PRD feature.

- **Variant 1 — calendar style**, four densities. Measured at a 1000px viewport:
  Comfortable renders a 1118px page (scrolls), Compact (84px cells) and Chips
  (62px cells) both land at 1000px and fit without scrolling, Detailed (180px)
  trades height for showing staff names inline.
- **Variant 2 — freeze the Mon–Sun header row**, or let it scroll with the grid.
- **Variant 3 — legend chips as filters**: clicking one hides that group from
  every day cell. The toggle turns the behaviour off so the chips read as a
  plain legend.

In Chips style the bar labels shorten to initial + count (`S2`, `A3`, `NR3`);
the full label would not fit on one line and would force the cell wider,
defeating the density the style exists for. Full names remain on hover.

---

## [0.2.0] — 2026-08-07

Roster module release. Adds an Operations section to the sidebar implementing
epic **MOVE-3429 (WLA: HR - Roster)**.

### Added

- **Roster Calendar 4.0** (`Roster4Page.tsx`) — conventional month grid,
  Monday–Sunday, greyed adjacent-month days, today highlighted, roster
  information as grouped bars `Group (n)` for On Leave / AM / PM / Off Day /
  No Roster / Standby, public holiday indicator, 12-month forward navigation,
  legend. As of the 11 Aug rewrite this is the variant that matches the PRD.
- **Roster Highlights** (MOVE-3607) — two badges over a rolling 60-day window
  from today: days with no standby coverage, and days with no AM/PM shift
  assigned. Rendered as compact pills on the title row that also filter the
  calendar to their affected days.
- **Manage Roster drawer** (MOVE-3609) — Current/Upcoming tabs, rule cards with
  effective range, patterns, weekly grids, standby and assignees. Ended rules
  hidden. Per-tab empty states.
- **Create / Edit Roster Rule** (MOVE-3610 / MOVE-3611) — one modal for both.
  Effective Date defaults to the day after the latest rule's end and pre-fills
  the previous rule's patterns; one employee per pattern per rule; a Current
  rule exposes only its End Date and hides Add/Remove Pattern. Overlapping
  periods rejected.
- **Delete Roster Rule** (MOVE-3705) — Upcoming rules only, behind a
  confirmation.
- **Edit Roster mode** (MOVE-3658) — current and future months only, past months
  disabled with a payroll tooltip, month navigation locked while editing, pick a
  day to edit it in a drawer, session-level Save/Cancel.
- **View Details Card** (MOVE-3659) — clicking a roster bar opens a view-only
  popover anchored to it, listing the staff in that group.
- **Roster Calendar** (`RosterPage.tsx`) and **Roster 3.0** (`Roster3Page.tsx`)
  — earlier matrix-layout explorations (employees as rows, dates as columns),
  kept side by side per the repo's original/2.0 convention. Roster 3.0 adds a
  per-day AM/PM headcount strip, status-grouped rows and filters.

### Changed — 7 Aug review feedback (Xing Yun Lee / Daniel Roy)

- Legend moved above the calendar, restyled after the Operations Calendar chip
  row.
- Day cells switched from small count chips to stacked bars `Group (n)`.
- **Coverage Gap removed entirely** — no longer a product concept, so it was
  dropped from the shared logic and all three variants, not just the calendar.
  Roster 3.0 lost its coverage-gaps filter toggle as a consequence.
- Public holidays read light green instead of red; a holiday is not an error
  state.
- Highlights realigned to the title row and made clickable filters.
- Clicking a bar opens a details card anchored to it rather than a drawer; the
  drawer became the edit-mode surface.

### Notes on the domain model

Follows the PRD's vocabulary: a **Roster Rule** owns an effective period and
repeat cycle and contains **Patterns**, each with its own weekly grids, per-week
standby flag and assigned employees. Rules may not overlap. There is no backend,
so mutations edit the shared mock arrays in place, consistent with the rest of
this repo.

---

## Open items

Tracked here so they do not get lost between sessions.

| Item | Status |
|---|---|
| **Public Holiday vs On Leave precedence** — MOVE-3608 carries an unresolved PM note: *"Should be PH over on leave cause it was their rest day hmm"*. Current behaviour keeps **On Leave winning**, per priority 1 as still written. | Awaiting PM decision |
| **Roster Calendar and Roster 3.0 are off-spec** — MOVE-3608 no longer describes a matrix layout at all, and both still use the bulk-select edit model MOVE-3658 replaced. | Awaiting a call on whether to retire them |
| **MOVE-3660 [Payroll] Standby Calculation** — ticket has no description. | Not implemented |
| **MOVE-3759 Design - Roster** — placeholder with no description, attachments, links or comments. | Nothing to build from |
| **MOVE-3608 internal inconsistency** — the AC still says "3 leading and trailing read-only dates", "scrolled into view" and "employee ordering follows the defined employee status sequence", all leftovers from the matrix version the body no longer describes. Implementation follows the body. | Worth raising with the PM |

---

## Earlier history

Changes before the Roster module (Customer Contracts, Invoice, Customer
Notification, Live Tracking) predate this changelog. See `git log` and
`DEVELOPER_GUIDE.md` for the structural picture, and `CLAUDE_SESSION_CONTEXT.md`
for the PRD-derived business rules of those modules.
