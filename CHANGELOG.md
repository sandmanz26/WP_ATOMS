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

### Changed — AM and PM are mutually exclusive per day again (feedback 4)

Picking someone for AM used to silently pull them out of that day's PM list.
The old per-pattern editor disabled an employee already assigned elsewhere, and
that is the behaviour the review asks for: somebody on AM is now **disabled** in
the same day's PM dropdown, labelled `— on AM` so the reason is visible, and
vice versa. The silent-release code is gone; nothing moves without being asked.

The clash test skips anyone already in the cell being edited, so a person who
somehow ended up in both lists can still be taken out of either.

Standby is unrestricted — it is independent of the shift (MOVE-3608), so an
employee can hold Shift + Standby on the same day.

### Fixed — raw employee ids in the pattern editor

Cells listed `emp-10, emp-12, emp-7…` instead of names. MOVE-3610 limits the
dropdown to Active employees, but a stored pattern can still name someone since
suspended or whose contract ended, and those ids had no entry to resolve
against. Names now come from the full roster, and already-assigned inactive
staff appear in the list tagged `— inactive`: they can be removed, but not
added anywhere new. Surfaced while verifying feedback 4, not reported.

### Changed — edit mode strips every group colour

Entering Edit Roster now turns all calendar bars a single neutral grey, so the
calendar itself says which mode you are in rather than leaving it to the
Save/Cancel buttons. This is also MOVE-3658 §2, "All group color to be remove",
which had not been picked up yet.

**One consequence worth watching:** the red `Standby (0)` gap indicator greys out
with everything else, so while editing you cannot see which days lack standby
cover — arguably the moment you would most want to. The instruction is explicit
in both the review and the ticket, so it ships as asked; say the word if that
one should stay red.

### Removed — repeated checkbox labels in the drawer's table layouts

Each row spelled out "Extend", "Standby" and "Absence" under column headers that
already said EXTEND / STANDBY / ABSENCE. The rows now carry bare checkboxes.
The stacked layout keeps its labels — it has no column headers to lean on.

### Changed — mock roster data made realistic (Daniel, 18 Aug)

The fixtures left several Operations staff unrostered on weekdays, which does
not happen in real operations. Rewritten so each day type carries only the
groups it should:

| Day | Groups |
|---|---|
| Mon–Fri | Standby, AM, PM |
| Sat | Standby, AM, Not Assigned |
| Sun | Standby, Not Assigned |

- All 13 Operations employees now sit in AM or PM every weekday, split into two
  teams that swap between week 1 and week 2 of the cycle. Saturday runs a
  three-person AM crew; Sunday nobody works.
- Standby rotates through the week per person instead of resting on one name.
- Leave is spread across 18 days of August rather than clustering. `lv-4` lands
  deliberately on a standby day (Eka is the week-1 Mon–Wed standby), so the red
  `Standby (0)` state still arises the way it does in real life — somebody was
  rostered to cover and then went on leave. That surfaces on 10–11 Aug.

Verified across all 31 days of August 2026: no day carries a group outside its
allowed set. The one apparent exception is **17 Aug**, a public holiday, where
MOVE-3608 requires every roster to become NA — a rule, not a data problem.

**Worth raising:** with Sunday now a proper rest day, the "unassigned roster"
highlight counts 9 days in the next 60 — 8 Sundays plus Malaysia Day. The badge
is behaving as MOVE-3607 defines it, but flagging intentional non-working days
as a coverage gap may not be what the badge is for.

### Added — Variant 7: shift pattern card style

The rule card's weekly headcounts can now be drawn two ways, on request:

- **Plain** (default, unchanged) — an open grid with no rules or fills.
- **Table** — bordered cells with a shaded header row, and the standby lines
  boxed to match, which is how the design sketch draws it.

Both render from the same `rule.weeks` data; only the chrome differs. The older
matrix variants share the drawer but have no switcher, so the prop defaults to
Plain there.

### Removed — Off Day (18 Aug review §5)

Off Day is gone as a concept. "Rostered but not working today" and "not in any
rule" were always the same thing to an ops user, and the review collapsed them
into a single **Not Assigned** (NA). This confirms the direction MOVE-3608 and
MOVE-3769 took on 18 Aug, which had been held pending the contradiction with
MOVE-3610.

- `ShiftCode` is now `'AM' | 'PM'`; `DailyStatus` loses `'OFF'`; the `OFF` and
  `NO_ROSTER` calendar groups merge into `NOT_ASSIGNED`.
- **Public holidays resolve to NA**, not Off Day. The edit drawer's picker shows
  NA alone that day, and the banner was reworded.
- **Weekends offer AM or NA**; a PM assignment on a weekend resolves to NA
  rather than being rewritten to Off Day.
- `ruleAssignmentFor` no longer needs rule membership: with both states collapsed
  the only question is whether the employee is in a shift list for that day.
- `DailyCoverage.off` dropped; public holidays now count under `na`.
- The two older matrix variants lost their Off Day cell colour, legend entry and
  bulk action, so their weekend bulk bar now offers AM only.

### Changed — fixed group order and the 18 Aug colours (§5, §6)

Order is now **Standby, AM, PM, Not Assigned, On Leave**, and the palette moved
to the review's swatches:

| Group | Fill | Text |
|---|---|---|
| Standby | `#2563eb` | white |
| Standby, count 0 | `#ef4444` | white |
| AM | `#a5a0f5` | black |
| PM | `#aec2fa` | black |
| Not Assigned | `#d4d4d4` | black |
| On Leave | `#fbdc8a` | black |

- **A group with a count of zero is dropped from the calendar — except Standby**,
  which stays and turns red. Zero is the thing worth seeing there: a day with no
  standby cover is a gap, and hiding the bar would hide the gap. In August 2026
  that surfaces four such days (9, 12, 14, 23 Aug).
- Standby regains a solid dark fill, so it no longer depends on being first in
  the order to stand out — the concern noted when the 14 Aug pastel palette
  landed.

### Changed — details card contents (18 Aug review §4)

`DayGroup` now carries `count` separately from `members`, because the two
deliberately disagree.

- **Absent staff are listed but not counted.** They used to be dropped from the
  group entirely, which meant the card could not show who was meant to be
  covering. They now appear with an **Absent** tag while the bar's headcount
  excludes them — verified on 20 Aug: marking one AM employee absent moved the
  bar from `AM (5)` to `AM (4)` with the name still in the card.
- **Extended staff are counted and tagged** `Extended`.
- **Reasons are confined to the Standby card.** The extension reason used to
  ride along in the shift group's card; the review keeps reasons to standby
  only, so a shift card now lists names and tags alone.

### Changed — shift patterns reshaped to the ADR-style grid (18 Aug review)

The three items in the review land together, because the first two change the
same data model.

**1. Button copy.** "Manage Roster" → **Manage Shift Patterns** (the button on
the calendar and the drawer's own title), and the drawer's "+ Add Rule" →
**Add Shift Patterns**. The modal, toasts, delete confirmation and empty states
follow the same vocabulary, so "rule" no longer appears in user-facing copy.
The two older matrix variants share the drawer and were updated with it.

**2. How patterns are added.** The editor is now grouped by week, split by
shift, with each day assigning employees from a dropdown — replacing the
per-employee pattern cards. The old editor asked "which days does this group
work?"; this one asks "who works this shift on this day?".

This required reshaping the stored model. `RosterRulePattern`/`PatternWeek` are
gone; a rule now holds `RuleWeek[]`, where each week carries `am`, `pm` and
`standby` as seven per-day arrays of employee ids. Consequences:

- **Standby moved from per-week to per-day.** It was one checkbox covering the
  whole week; it is now assigned day by day, which is what the sketch's separate
  "Standby week 1" row and the view's "Hity (Mon–Wed, Sat)" summary both need.
- **PM is disabled on Sat/Sun** in the grid rather than accepted and silently
  corrected later, matching MOVE-3608's weekend rule.
- **One shift per employee per day** is enforced as you type: putting someone in
  AM removes them from PM on that day.
- **Not being in a shift list is the whole answer.** An employee not named in
  the AM or PM list for a day is Not Assigned, resolved by `ruleAssignmentFor`
  in the shared logic so all three page variants move together. (This landed
  first as an Off Day / No Roster distinction based on rule membership; §5 of
  the same review then removed Off Day, so the distinction went with it.)
- Day cells are too narrow for name tags, so each control shows a headcount with
  the names listed underneath, as the sketch draws them.

**3. How patterns are viewed.** The rule card now shows a headcount per shift
per day (`Week 1 - AM  3 3 3 3 3 3 3`) with standby summarised per person below
(`Week 1 Standby: Bella Santoso (Mon–Wed, Sat) | Eka Wijaya (Thu–Fri, Sun)`),
consecutive days collapsed into ranges. Edit and Delete keep exactly the
behaviour MOVE-3609/3705 specify — Edit on every card, Delete on Upcoming only,
and a Current rule still locks everything but its End Date.

Mock data was rewritten into the new shape. Calendar output is unchanged except
for standby counts, which now vary by day instead of applying to a whole week.

### Changed — page header reworked to the target design (17 Aug)

- **Breadcrumb is rooted in a home icon** and the Roster 4.0 route now reads
  `/ Roster`. The icon is added in `AppLayout`, so every page in the prototype
  picks it up, not just this one.
- **Page title is plainly "Roster"** (`Roster Calendar 4.0` before), larger and
  bolder. The 4.0 is a prototype variant number and does not belong in product
  copy; the sidebar still names the variant so the three can be told apart.
- **Highlights became stat cards** on their own row between the title and the
  calendar, rather than inline pills floated right of the title. The count reads
  large with what it counts underneath. They remain clickable filters: the
  active card carries a blue border, replacing the old tinted-pill treatment
  that leaned on a per-highlight tone colour.

  The design mock showed a large number *and* a second number inside the label
  (`14` above `12 unassigned shift`). The count is rendered once, as the number —
  showing two different figures on one card would only raise the question of
  which one is real.

### Changed — On Leave rows in the Edit Roster drawer (feedback 2)

- **The On Leave tag now carries the calendar's On Leave swatch** (`#ffa6c9` on
  black) instead of AntD's gold, so the same status reads the same colour in the
  grid and in the drawer.
- **The row highlight is gone.** An On Leave row had a yellow background on top
  of its tag and disabled controls, which made the one row nobody can edit the
  loudest thing in the drawer. It now looks like every other row and says
  view-only the way an Absence row does — through its own disabled fields.
- **On Leave rows keep their Extend / Standby / Absence checkboxes, disabled**,
  rather than leaving three empty cells in the table. Their sub-text is
  suppressed though: leave clears standby (MOVE-3608), so "Standby from Rule"
  under an unticked, disabled box would claim an assignment that does not exist
  that day.

### Fixed

- **"Off Day" wrapped to two lines in the shift picker**, so weekend and holiday
  rows in the Edit Roster drawer stood ~25px taller than weekday rows. The
  buttons no longer wrap and the table's Shift column widened from 148px to
  180px to fit the longest option set. Measured on 15 Aug (weekend) and 20 Aug
  (weekday): row heights and total content height are now identical at 513px.
- **Public holidays overflowed the Shift column.** The picker was built by
  appending Off Day to the day's normal options, which on a weekday holiday gave
  a four-option row (AM/PM/NA/Off Day) too wide for the column — the label was
  clipped into the Extend column. Since the shift is fixed and read-only that
  day, the picker now shows Off Day alone; the banner above already explains
  why. Found while verifying the wrapping fix, not reported.

### Changed — group colours set to the design's "Final Selected" swatches

| Group | Fill | Hover | Text |
|---|---|---|---|
| Standby | `#ffd59e` | `#ffc069` | `#1a1a1a` |
| Off Day | `#d9d9d9` | `#bfbfbf` | `#1a1a1a` |
| AM | `#7fe7d5` | `#4fd8c0` | `#1a1a1a` |
| PM | `#aec2fa` | `#87a5f7` | `#1a1a1a` |
| No Roster | `#fce588` | `#f7d94c` | `#1a1a1a` |
| On Leave | `#ffa6c9` | `#ff7fb2` | `#1a1a1a` |

Set once in `DAY_GROUP_STYLE`, so the calendar bars, the legend chips and the
details card all move together. Two behavioural consequences, both intended by
the swatches but worth recording:

- **Fill no longer encodes severity.** Every group is a light pastel with black
  text, so Standby lost the solid dark blue that made it the loudest bar. Being
  first in `DAY_GROUP_ORDER` is now the only thing that makes it findable.
- **No Roster is a real fill.** It was a transparent, dashed outline that read
  as "nothing here"; it is now solid yellow and drops its border, so a day with
  unrostered staff carries as much visual weight as one without.

The On Leave chip in the drawer's "Separate section" variant now reads from the
On Leave swatch instead of carrying its own red. The two older matrix variants
(`RosterPage`, `Roster3Page`) keep their existing `STATUS_COLORS` palette — the
swatches name the Roster 4.0 groups, and those pages are already flagged for
retirement in Open items.

### Added — fourth review round: Edit Roster drawer layouts (feedback 1)

The stacked list ran too long to scan — at 480px wide, nine staff overflowed the
drawer. Two table layouts were added and put on the switcher as **Variant 6**,
with the stacked list kept as the third option. Measured on 20 Aug 2026 (nine
staff): stacked 929px of content, table 513px, grouped table 621px. Table is now
the default; only the stacked list still scrolls.

- **Table** — one row per employee across fixed columns (Employee / Shift /
  Extend / Standby / Absence), with a sticky header. Drawer widens to 760px for
  the table layouts and stays at 480px for the stacked list.
- **Grouped table** — the same rows split into sections by the shift each
  employee is currently on, each with a count (`AM (5)`, `No Roster (3)`,
  `On Leave (1)`), for reading coverage rather than individuals.

All three layouts share one set of cell renderers, so a behaviour fix lands in
every layout at once — the same reasoning that keeps the status rules in
`rosterStatusLogic.tsx`.

### Changed — fourth review round

- **Calendar bar order is now Standby, AM, PM, Off Day, No Roster, On Leave**,
  set in `DAY_GROUP_ORDER` so every variant follows. Previously On Leave sat
  second, directly under Standby. The 14 Aug review first placed Off Day ahead
  of AM; the 17 Aug review corrected it to sit after PM, because putting Off Day
  second made weekend cells — where most staff are off — read in a different
  sequence from weekday cells. Verified across all 31 populated day cells of
  August 2026, weekends and the 17 Aug public holiday included.
- **Highlight pills reworded** (feedback 3) to `12 unassigned shift in next 60
  days` and `13 unassigned roster in next 60 days`. **Flagged:** applied in the
  order the two labels were written, which puts "unassigned shift" on the
  standby-coverage count and "unassigned roster" on the AM/PM count — the
  reverse of what each one measures. Left as written rather than silently
  swapped; see Open items.

### Removed

- **The page subtitle** "Operations department — month grid with daily coverage"
  and **the legend row** above the calendar (feedback 2). The legend's two
  earlier behaviours stay reachable through **Variant 3**, which became a
  three-way choice — Hidden (the new default), Filters, Plain — rather than the
  on/off switch it was, so the removal ships without losing the filtering
  behaviour built last round.

### Changed — third review round (Edit Roster drawer)

All four items land in the drawer's employee rows.

- **Each modifier's state now sits under its own checkbox** (feedback 2). The
  row's checkboxes became a three-column grid — Extend / Standby / Absence — and
  the detail belonging to each one is rendered directly beneath it: the
  extension reads `4h · <reason>` under Extend, and "Standby from Rule" plus the
  standby reason sit under Standby. Previously both were pooled into a shared
  `Extension: … Standby: …` line at the end of the row, which meant reading the
  label to work out which checkbox a value belonged to.
- **The extension detail is grouped with the Extend checkbox** (feedback 6),
  which is the same move as above seen from the other side: the `Extend 4h` tag
  that used to trail the shift picker is gone, so the hours and the reason are
  in one place rather than split across the row.
- **The Absence tag moved next to the employee name** (feedback 5). It used to
  sit beside the shift selector, where it read as a property of the shift.
  Absence is a property of the person for that day, so it now reads with the
  name. Marking someone absent also disables their Extend and Standby
  checkboxes — an absent employee is not covering a shift, so they cannot be
  extended or held on standby either.
- **Re-ticking rule-assigned standby no longer asks for a reason** (feedback 5).
  Unticking Standby for an employee the roster rule puts on standby and then
  ticking it again used to open the reason modal, as if it were a manual
  assignment. It now restores the rule's standby directly; only standby the user
  is genuinely adding by hand goes through the modal.

### Removed

- **Placeholder text in the Extend and Standby modals** (feedback 3). Both
  fields already carry a label and a required marker, and the placeholders
  ("Why is this employee on standby?", "Why is this shift being extended?",
  "e.g. 2") only restated them. The screenshot marked the standby one; the
  Extend modal's two were removed with it so the pair stays consistent.

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
| **"No Roster" vs "Not Assigned"** — resolved by the 18 Aug review: Off Day is removed and both states collapse into Not Assigned. | Resolved |
| **Highlight pill wording is inverted** — the 14 Aug review asked for "x unassigned shift" and "x unassigned roster", in that order. Positionally that puts "unassigned shift" on the *standby-coverage* count and "unassigned roster" on the *AM/PM shift* count, which is backwards for both. Shipped as written; a one-line swap fixes it either way. | Awaiting PM confirmation |
| **MOVE-3608 internal inconsistency** — the AC still says "3 leading and trailing read-only dates", "scrolled into view" and "employee ordering follows the defined employee status sequence", all leftovers from the matrix version the body no longer describes. Implementation follows the body. | Worth raising with the PM |

---

## Earlier history

Changes before the Roster module (Customer Contracts, Invoice, Customer
Notification, Live Tracking) predate this changelog. See `git log` and
`DEVELOPER_GUIDE.md` for the structural picture, and `CLAUDE_SESSION_CONTEXT.md`
for the PRD-derived business rules of those modules.
