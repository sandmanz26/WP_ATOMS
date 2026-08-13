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

### Changed — second review round

- **Public holidays now override No Roster too** (feedback 5). Employees with no
  roster rule used to keep a No Roster bar on a holiday; they now read Off Day
  like everyone else, so 17 Aug went from `Standby (2) · Off Day (6) ·
  No Roster (2)` to `Standby (2) · Off Day (8)`. This puts the holiday check
  ahead of the No Roster check, the reverse of MOVE-3608's priority table —
  nobody is working on a public holiday, rostered or not.
- **The shift picker carries real contrast** (feedback 7). AntD's Segmented
  rendered the selected option as a barely-distinguishable white tile, which lost
  next to the bright blue Standby checkbox. Replaced with a small custom control
  whose selected option is a solid blue fill. Available as **Variant 4** in the
  switcher, with the original look kept as "Subtle".
- **On Leave staff can sit in the main list** (feedback 1) with their shift shown
  but disabled and an On Leave tag, so ops can see which shift the person was
  meant to cover. Available as **Variant 5**, with the original separate
  view-only section kept as "Separate section". `resolveShiftIgnoringLeave`
  derives the underlying shift by re-running the normal rules with that
  employee's leave removed, rather than duplicating the priority chain.

### Removed

- The edit-mode helper line above the calendar.

### Added — MOVE-3769 Edit Roster Calendar Drawer

The drawer spec was split out of MOVE-3658 into its own ticket on 12 Aug and
grew considerably.

- **NA is now a shift option.** Weekdays offer AM/PM/NA, weekends AM/Off Day/NA.
  NA is an explicit "no roster rule applies" pick, distinct from an employee
  simply having no pattern, so `RosterOverride.shift` widened to a new
  `ShiftSelection` type.
- **Extend checkbox.** Ticking it opens a modal asking for the number of hours
  and a reason, both required; the box only turns on once they are saved, so
  cancelling leaves it untouched. Extend is independent of the shift — an
  employee can hold Shift + Extend + Standby.
- **Standby now captures a reason.** Ticking Standby by hand opens a modal
  requiring a reason, shown next to the checkbox afterwards and cleared when
  unticked. Standby that comes from the roster rule does not go through the
  modal.
- **"Standby from Rule" indicator**, shown for employees the rule puts on
  standby and deliberately kept visible even after the user unticks the box.
- **Absence checkbox.** The employee keeps their shift, but the shift control
  locks and an Absence tag appears beside it; unticking restores editing.

### Changed

- Group counts exclude employees marked Absent (MOVE-3608 §2.2). They keep a
  shift in the drawer but are not covering it, so counting them overstated the
  day's coverage. Roster 3.0's coverage strip follows the same rule.
- The details card shows the reason where one was captured — extension reason in
  shift groups, standby reason in the Standby group (MOVE-3659 §1). `DayGroup`
  now carries `members` (employee + reason) rather than a bare employee list.

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

### Added

- Hover feedback on the roster bars in each Roster 4.0 day cell, on request.
  Each group darkens one step on the same AntD colour ramp, so a hovered bar
  reads as the same status rather than a different one. "No Roster" is
  transparent and has nothing to darken, so it fills in with a light grey and
  its dashed border deepens instead. The bar whose details card is open stays
  darkened, which doubles as a pointer back to the anchor. Bars do not react in
  edit mode, where the day cell — not the bar — is the click target.

### Changed

- The Off Day group reads **"Off Day"** rather than "Off", in the calendar bars,
  the legend, the Manage Roster rule cards and the Create/Edit Roster Rule week
  grid. The rule card's day cell widened from 44px to 52px so the longer label
  still fits on one line.

### Removed

- The "Click a bar to see which staff are in it…" helper line above the Roster
  4.0 calendar, on request. The edit-mode helper line stays, since that mode's
  interaction is not self-evident.
- The `"No Roster" = joined, no roster set` subtext from the Roster 4.0 legend.
- The leave type/timing tooltip on the On Leave chips in the Edit Roster drawer.
  Operations hours differ from the rest of the company, so someone on leave is
  effectively unavailable regardless of a half-day marker, and surfacing the
  timing invited the wrong inference.
- The "… — click to cycle" tooltip on the Create/Edit Roster Rule week grid.
- The "Hide/Show … from the calendar" tooltip on the legend chips. The chips
  still filter; the greyed-out, struck-through state already says which groups
  are hidden.

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
