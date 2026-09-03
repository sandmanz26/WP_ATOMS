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

### Added — Leave module: listing page (MOVE-1975)

A new top-level **Leave** menu entry and its listing, one row per employee.
Built on the listing chrome the app already uses (Invoice 2.0 / the Inspection
reference): right-aligned toolbar, Filter popover behind the funnel, detached
pagination card. No new patterns — the point is that Leave looks like every
other listing.

**Against the ticket, verified live:**

- **Columns** — Employee, Hiring Company, Department, AL Balance, ML Balance,
  Last Updated On (biz req 1).
- **Active contracts only.** The dataset holds 22 employees; 19 reach the table.
  A Terminated, a Resigned and a Future Employee are in there deliberately so
  the rule is visible in the count rather than taken on trust.
- **Hiring Company shows the most recent contract, the rest as `+n`** — Bella
  Santoso renders `Westpoint Coach +2`, with the hidden ones on hover so
  nothing is actually lost.
- **Default sort is Last Updated On, newest first** (biz req 2), confirmed by
  reading the rendered column: 26 → 14 Aug descending.
- **Sorting matches the acceptance criteria exactly**: Employee, Hiring Company,
  Department and Last Updated On carry sorters; **AL and ML Balance do not.**
  Measured from the rendered headers, since that distinction is easy to get
  wrong and invisible in a screenshot.
- **Search** is a full-text match on Employee alone, placeholder "Search
  Employees" — "bella" narrows 19 → 1.
- **Filters** — Hiring Company (multi-select), Department (multi-select with
  auto-complete, "Not applicable" included as a real option), Last Updated On
  range, plus Clear all filters. Department = Human Resources gives 2.

**Judgment calls worth knowing:**

- **Balance is derived, not stored.** MOVE-3494 biz req 2 row 6 defines it as
  `entitlement − used − pending approval`, with a null entitlement rendering as
  `-` regardless of what has been taken. Modelling it that way means the listing
  cannot drift from the profile page when that ticket gets built; Eka Wijaya has
  no ML entitlement so the dash is exercised.
- **The "x days ago" sub-text is computed** from the timestamp rather than
  stored as a second string the way other listings do it — those two can drift,
  and here they cannot.
- **The Last Updated On range picker sits in the toolbar**, not the popover, as
  the reference layout places it. It also appears in the popover so both routes
  work off the same state.
- **Leave is top-level, not under Operations.** The listing is HR's and spans
  every department, so nesting it under Operations would have implied a scope
  it does not have.
- **Two linked destinations are stubs.** "Manage Leave Types" (MOVE-1977) and
  the row click through to the Employee Leave Profile (MOVE-3494) are separate
  tickets; both are wired and say plainly that they are not built rather than
  opening an empty page.

### Changed — Live Tracking 2.0 opens on the reviewed Display settings

The panel's settings were signed off in the 28 Aug review, so they are the
page's starting values now rather than eleven controls to set by hand each time
the demo is opened. Every one stays switchable; only the default moved.

Eleven changed, and all 25 rows were read back from the live panel to confirm
they match the reviewed screenshot:

| Setting | Was | Now |
| --- | --- | --- |
| List : map size | 60 : 40 | **65 : 35** |
| Slack format | Minutes (130min) | **Hours + min (2hr 10min)** |
| Show delay text | on | **off** |
| Driver status text | on | **off** |
| L2 spacing | 12px | **24px** |
| Flashing | Ring | **Glow** |
| L2 font | 11px | **12px** |
| Box padding | 10px | **14px** |
| Show route | on | **off** |
| Show traffic | on | **off** |
| Use dummy data | off | **on** |

The other fourteen already matched: Silver map, Rev 03 card, 9. Panel highlight,
Bus markers, Default map card, map on the Left, Drawer detail panel, action On
card, Claim workflow, Text claim button, All cards (v1), Category colour,
Compact width, Row slack position, Dropdown sort, L2 match L1 width off, L1
font 24px.

**Worth knowing: `Use dummy data` now defaults on**, which swaps the dataset the
page builds its stops from — the demo opens on `DUMMY_STOPS` rather than
`DEMO_TRIPS`. That is what the reviewed panel showed, so it is what shipped, but
it is the one default here that changes the data rather than the presentation.

### Added — three more shift-picker styles (Variant 4 now has five)

Asked for on the 28 Aug review. Rather than five shades of the same idea, the
five differ along three separate axes: what the selection is coloured with,
how heavy the frame around it is, and whether it is a set of buttons at all.

- **Shift colours** *(new)* — the selected shift wears the swatch the calendar
  already gives it: AM lilac, PM blue-grey, NA grey. The drawer and the month
  grid then agree on what AM looks like, and blue is left to Standby alone,
  which is the coverage decision the eye should find first. Verified live: the
  selected AM renders `#a5a0f5`, the same value as `DAY_GROUP_STYLE.AM`.
- **Pill group** *(new)* — one rounded frame around all three options with
  hairlines between them, instead of three separate boxes. The lightest of the
  button styles; the group owns the radius and clips the fill.
- **Dropdown** *(new)* — a compact Select. Measured at **92px against 140px**
  for the button row, and the only option that would still fit if the shift
  list ever grew past three. It costs a second click per change, which is the
  wrong trade when setting eleven rows in a row — it earns its place on width,
  not on speed, and the switcher hint says so.
- **Strong** and **Subtle** are unchanged. Strong stays the default.

**Tidied while here:** `ShiftContrast` was declared twice — once in
`ShiftSelector.tsx` and once in `RosterVariantSwitcher.tsx`. The two copies had
already drifted. There is now one definition, held with the rest of the variant
types, and `ShiftSelector` imports it.

### Added — Variants 10 and 11: the view drawer stops pretending to be a form

Two options asked for on the 28 Aug review of the View Roster drawer. Both
default to the new reading; the previous behaviour stays selectable so the two
can be compared.

**Variant 10 · Viewing a day — `Plain values` (default) / `Disabled controls`.**
The read-only drawer was drawing the *edit* controls with everything greyed out:
eleven rows of dead AM/NA buttons and empty checkboxes, which made View look
like a broken Edit and gave the eye nothing to skip. Viewing now renders values:
the shift as a coloured tag in the calendar's own swatches, and each modifier as
its name when on or an em-dash when off. Measured live — the view drawer went
from **33 checkboxes to 0**, while Edit is untouched at 33.

- Sub-text is kept, not dropped: "Standby from Rule", a standby reason, and the
  extension's `4h · reason` still read under their column.
- The two modes are now told apart at a glance, which the flow needs more than
  it used to: since MOVE-3967 a cell click lands on View, so that is the screen
  ops sees first and most often.

**Variant 11 · Day summary — `Count chips` (default) / `Off`.**
The drawer opened on nothing but "11 Employees", so the shape of a day had to be
counted off the rows. A chip row now restates the same numbers the calendar bar
already carries, in the place the detail is actually read.

- **Standby always shows, red at zero**, reusing `EMPTY_STANDBY_STYLE` — a day
  with no cover is the one number worth seeing even when it is nothing, exactly
  as the calendar draws its empty-standby bar.
- Extended and Absent appear only once there is one. A row of zeroes is the
  noise this summary exists to remove.
- Absent, suspended and On Leave staff are excluded from the standby and extend
  counts, matching the rule the calendar bars already use, so the drawer and the
  grid cannot disagree.
- Shown in both modes — the counts are as useful while editing as while reading.

### Changed — day cells react to hover, switcher rebuilt on the Live Tracking 2.0 panel, Roster 3.0 off the menu

Three items from the 27 Aug review.

**Day cells now answer a hover.** The cell became the click target when the
Edit Roster button went away, and nothing said so. Hovering an in-month cell
tints it (`#f0f7ff`, or a deeper `#bae0ff` on today, which is already blue) and
draws a 1px inset border. Out-of-month cells do not react — they open nothing.
The cell lifts to `z-index: 1` on hover so its highlight is not clipped by the
neighbour overlapping it by 1px.

**The hover wording is a new Variant 9 · Cell hover text**, with three settings
rather than two. The review asked for "Click to edit", but a cell click opens
the day **read-only** first (MOVE-3967) and Edit sits inside the drawer,
disabled on a past month — so "Click to edit" over-promises there. Rather than
silently overrule the request or ship copy that lies on past months, both are on
the switcher: **Off**, **Click to view** (default, matches the built flow), and
**Click to edit** (as asked). Pick one and it becomes the only one. The label
sits on the date row rather than below it, so showing it costs no height and the
bars underneath never shift.

**The switcher now wears Live Tracking 2.0's chrome**, as requested — the same
amber "Display settings" panel: 260px wide, amber header and drag handle, one
compact label-plus-control row per option, hairline dividers between groups, and
a circular amber reopener. Eight Segmented stacks became eight small Selects,
which is most of why the panel got shorter.

- **Judgment call worth knowing:** that layout has no room for the line of prose
  under each option, and the explanations were what made the panel demoable to
  PM. They moved onto the label as a tooltip rather than being deleted.
- The panel's dropdowns render at `z-index: 2100`; the panel itself sits at 900,
  below AntD's drawer layer, and its menus would otherwise open behind the
  calendar.

**Roster 3.0 is out of the sidebar** so it cannot be mistaken for the live
design. Per CLAUDE.md, Roster 4.0 is the variant that matches the PRD; 3.0 stays
in the code and on its route as a prior exploration, just not somewhere a
reviewer can wander into by accident.

### Fixed — Extend is now locked on public holidays (MOVE-3769 §3)

Found while re-checking the ticket over whether the edit drawer allows more than
one checkbox per row. It does — but the public-holiday table in MOVE-3769 §3
lists **Extend: Disable**, and only Shift was being disabled. There is no shift
to extend when every employee defaults to N.A., so Extend is now guarded by
`dayHoliday` alongside Shift. Standby and Absent stay enabled on a PH, which is
what the same table asks for.

The banner copy followed: it used to promise only that "standby can still be
assigned", which understated what is locked and what is not.

**On the multi-check question itself — the ticket is explicit, and the build
already matches it:**

- MOVE-3769 §2.1 says standby "is independent of (does not affect) AM/PM shift
  assignment", extension "is independent of (does not affect) AM/PM/standby
  assignment". So Standby + Extend together on one row is correct, not a bug.
- **Absent is the exception.** It is worded as independent too — ticking it does
  not clear the values already set — but the same row adds "Disable all fields
  in employee's row". Verified live: after ticking Absent, Shift, Standby and
  Extend all go read-only with their values and sub-text intact, and Absent
  itself stays clickable so the row can be released again. The spec says
  "all fields", which taken literally would trap the user; treating Absent as
  the one field that stays live is the reading that makes the "If uncheck →
  enable all fields" sentence work.
- Suspended rows disable everything including Absent, per §2.1 row 2.

### Added — Variant 8 · Design system, an on/off switch for the Figma tokens

Requested so the two can be compared before committing to one: the switcher's
new **Variant 8** runs the whole Roster 4.0 page on the team's Figma design
tokens, or leaves it on AntD's defaults. Three settings — **Off**, **Figma
tokens**, **Figma compact**. Off is the default, so nothing moves unless someone
asks for it.

- **`figmaTokens.ts` is generated, not hand-written.** Every value is resolved
  from the Tokens Studio export (`variables_1.json`), aliases included
  (`{Colors.Base.Blue.6}` and friends). Re-export from Figma and regenerate
  rather than editing it. Two objects: `FIGMA_TOKENS_DEFAULT`
  (colors-light + dimensions-default + typography-default) and
  `FIGMA_TOKENS_COMPACT` (the same colours on the compact scale).
- **The honest finding: the export is a stock Ant Design 5 palette.**
  `colorPrimary #1677ff`, `colorSuccess #52c41a`, `colorError #ff4d4f`,
  `colorBorder #d9d9d9`, `borderRadius 6`, `fontSize 14` — all identical to what
  the prototype already renders. So **Figma tokens** differs from **Off**
  essentially only in the typeface. **Figma compact** is the real comparison:
  measured live, buttons go 32px → 28px and body type 14px → 12px.
- **`fontFamily` got a fallback stack.** The export names `SF Pro Text` alone,
  which exists only on macOS; on anything else the browser would have dropped to
  its default serif and made the comparison meaningless. The system-UI stack is
  appended behind it — judgment call, noted in the file.
- **`ConfigProvider` wraps the whole page, not just the calendar**, so drawers,
  modals and popovers inherit the theme: AntD threads it through React context,
  not the DOM. Verified live — the day drawer renders at 12px/28px controls in
  compact mode.
- **The switcher panel itself sits outside the themed tree.** It is a demo
  control, not product surface, and at the compact scale it would have shrunk
  along with everything else and become awkward to drive.
- **Scope limit worth knowing before judging the comparison:** this changes AntD
  chrome only — buttons, inputs, selects, checkboxes, drawers, modals, tabs,
  tags, typography. The calendar's own bar colours (Standby blue, AM, PM, On
  Leave amber, the empty-standby red) are separately approved design swatches
  outside this token set and do not move.
- Three exported names (`colorFillAlterSolid`, `fontWeightNormal`,
  `transparent`) have no counterpart in AntD 5's `AliasToken` and are dropped —
  they would not have been read anyway.

### Changed — edit mode replaced by a view-then-edit drawer (MOVE-3967)

The 26 Aug flow change is in Jira: **MOVE-3658 (Edit Roster Mode) is cancelled**
— its summary now reads `[x] Edit Roster Mode (Calendar View)` — and a new
**MOVE-3967 "View Roster - Individual Date (Drawer)"** replaces it. MOVE-3608's
CTA table was rewritten to match.

- **The "Edit Roster" button is gone.** Manage Shift Patterns is the calendar's
  only CTA now.
- **Clicking a day cell opens that day's drawer, read-only** — on any month,
  including past ones. Header reads `View Roster - Thursday, 20 Aug 2026`, with
  the day name spelled out as the ticket asks.
- **The drawer's Edit CTA switches the same drawer into editing** rather than
  opening a second one, which is how MOVE-3967 §3 words it. Header becomes
  `Edit Roster - …` and Cancel/Save replace the Edit button.
- **Edit is disabled on a past month**, with the existing payroll tooltip.
  Viewing stays available there.
- **A bar click and a cell click are separate actions** (MOVE-3608 §3): the bar
  opens the Shift Details Card, the cell opens the day drawer. The bar now stops
  the click propagating, or one press would have done both.

**Consequences of losing the session**

- **A day's Save commits immediately.** There is no calendar-level session left
  to stage into, so the page-level Save/Cancel are gone with it. MOVE-3769 §4
  still describes staging "until user selects 'save all edits' … in edit roster
  mode" — that text predates the flow change and now points at a cancelled
  ticket. Flagged rather than followed.
- **Cancel returns the drawer to viewing** instead of closing it, so you stay on
  the day you were looking at. MOVE-3769 §4.2 says the drawer closes, but that
  line also assumes the cancelled mode.
- **Month navigation is never locked**, and the calendar no longer greys out —
  both existed only to signal edit mode. `EDIT_MODE_GROUP_STYLE` and the
  `greyed` prop were swept.

### Added — suspension is now date-aware (MOVE-3608 + MOVE-3769, both updated 25 Aug)

Xing Yun's report was right and both tickets now say so in writing. MOVE-3769:
*"If employee status = suspended on selected date → display 'suspended' tag
beside employee's name **+ disable all fields in employee's row**"*. MOVE-3608:
*"**Even if assigned, don't include** employee in Standby/AM/PM/N.A. count for
that date if … Employee status = suspended for that date"*.

**The model had to change first.** MOVE-3608's own example runs "suspended from
10–20 Aug … on 21 Aug the count includes them again", so suspension is a period,
not a flag — and `RosterEmployee.status` was a single static label that could not
express it. Applying the rule to the static label would have excluded a
suspended employee from every day of every month.

- **`RosterEmployee.suspensions`** — a list of `{ startDate, endDate? }` periods,
  with `isSuspendedOn(employee, date)` in the shared logic as the single answer
  the drawer, the counts and the details card all consult. `status` stays the
  plain HR label the older matrix variants group by. In production this would
  sync from the HR Employee module (MOVE-1607).
- **Fixtures** carry the ticket's own example: Farhan Hakim suspended 10–20 Aug,
  Gita Permata 24–26 Aug, so the behaviour changes mid-month and can be checked.

**Behaviour**

- **Drawer** — a suspended row keeps its place in the list, gains a `Suspended`
  tag beside the name, and every field is locked: shift buttons, Standby, Extend
  and Absence.
- **Counts** — suspended staff drop out of Standby / AM / PM / Not Assigned,
  exactly as absent staff already did. Verified against the ticket's example:
  20 Aug reads `AM (3)`, 21 Aug reads `AM (4)` — same week, same pattern, the
  only difference being that Farhan's suspension ended.
- **Details card** — they stay listed with the tag, because MOVE-3659 wants the
  list to include everyone assigned *"regardless of suspension, absence, or
  leave"*. Verified: 11 Aug's PM card lists Farhan Hakim tagged `Suspended`
  while the bar count excludes him; on 21 Aug the tag is gone.
- **Highlights** — a suspended employee no longer counts as standby or shift
  cover for the 60-day badges.

### Changed — Edit Roster drawer actions moved to the header

Cancel and Save were in a footer at the bottom of the drawer; they now sit at
the top right of the header, matching the Create Event pattern. This also puts
them beside the close button and keeps them in view while a long employee list
scrolls. The Manage Shift Patterns drawer already carried its action there, so
the two now agree.

Save still stays disabled until something is actually staged.

Scoped to drawers, as asked — the Shift Patterns / Extend / Standby dialogs are
AntD Modals and keep their footers.

### Changed — 22 Aug review

**Pattern editor: names live in the control (item 1)**

The paragraph of names under each cell is gone. Staff now appear as removable
tags inside the dropdown itself, following the Fleet Owner control the review
pointed at:

- **Three tags visible, then `+n`.** One tag fills a cell line, so three is the
  three-line cap the review asked for. A `7 selected` subtext keeps the total
  readable at a glance.
- **The option list is grouped by state** — `Selected (n)`, `Available`,
  `Unavailable (AM)` — so the eye lands on what is already picked before
  scanning what is free. Empty groups are omitted.
- Cells widened 124px → 148px and the modal 1180 → 1320 to fit all seven day
  columns without clipping Sunday.

**Shift pattern card (items 3, 4)**

- Both axes of the headcount table read **bold** — the week/shift row labels as
  well as the day headers. Both are labels; only one was.
- Tab counts became **circular badges** (`Current ●1`) instead of `(1)`,
  matching the badge the routes module already uses.

### Fixed — details card was missing the extension reason (item 5, MOVE-3659)

The card showed an `Extended` tag with nothing to explain it. MOVE-3659 was
rewritten on 21 Aug (and renamed *Shift Details Card*); its table asks for the
tag **plus the reason for extension**, so the hours and reason now read under
the tag: `4h · Covering late run`.

This reverses the 18 Aug reading that confined reasons to the Standby card.
Checking the ticket, as asked, also turned up three other gaps we had not met:

- **Standby always names its reason.** MOVE-3659 wants one beside every standby
  name — *"'Assigned in pattern', or whatever user manually input"*. Standby
  that came from the rule showed nothing; it now reads `Assigned in pattern`.
- **Suspended staff carry a tag.** The ticket says the list includes all
  assigned employees *"regardless of suspension, absence, or leave"*, each
  tagged. Absent and Extended were tagged; Suspended was not.
- **Empty standby copy** matches the ticket's `No employee assigned`.

The ticket also confirms in writing that the bar count and the card list need
not match — which is what the absent-but-listed rule produces.

**Not done, deliberately:** the ticket's `on leave` tag inside shift groups is
bracketed `[Implement after leave module]` and says to assume a zero leave count
for now. Adding it would also contradict MOVE-3608, where On Leave overrides
every other status and is its own exclusive group. Left alone and raised here.

### Changed — public holidays name themselves in the cell (feedback 6)

The flag icon is gone and so is the green cell wash. A holiday now prints its
name on the date row — `17 Independence Day` — in small green text.

- The flag meant nothing until hovered; the name says what the day is on sight.
- Removing the tint also removes a competing signal: with the group colours
  already carrying meaning, a green background made holidays look like a status
  rather than a label. Verified 17 Aug and 18 Aug now share the same white
  background, and no flag icon remains anywhere.
- The name sits on the existing date row rather than a new line, so cell height
  is unchanged in every calendar density; it truncates with an ellipsis and
  keeps the full text in a title tooltip for the compact styles.
- The legend's **Public Holiday chip is dropped**. It keyed the flag and the
  green wash, neither of which is drawn any more, and a holiday is not one of
  the group bars the legend exists to explain.

The green *text* is a judgment call — it keeps the holiday association the wash
used to carry without tinting the day. Say the word if it should be neutral.

### Changed — 19 Aug review: pattern editor and drawer legibility

**Pattern editor**

- **Day headers read Mon–Sun** instead of `M T W T F S S`. The single letters
  were ambiguous (two Ts, two Ss) and the column had room for the full name.
- **Names stack one per line** under each cell. As a comma-separated run they
  wrapped into a four-line block that broke mid-name, so you could not tell
  where one ended and the next began. Cells widened from 112px to 124px and the
  text stepped darker (`#595959`).
- **Effective Date is editable until it has passed.** MOVE-3610 specifies it as
  view-only, derived from the previous rule; the review asks for it to stay
  editable while it is still in the future, and to lock only once the date is
  past — at which point the roster it produced is history. A Current rule stays
  locked wholesale per MOVE-3611. Past dates cannot be picked, and the End Date
  picker re-validates against the new Effective Date.

**Edit Roster drawer**

- **Standby now comes before Extend**, in the header and every layout. Standby
  is the coverage decision; Extend is a detail on top of a shift already
  assigned.
- **The table carries real contrast.** It read as one pale wash: header
  `#fafafa` on light-grey text, `#f5f5f5` row rules, and AntD's default
  `#d9d9d9` control border left unticked checkboxes almost invisible. Header is
  now `#f0f0f0` with `#434343` bold text, borders `#d9d9d9`/`#e8e8e8`, sub-text
  `#595959`, and a scoped `ConfigProvider` darkens the checkbox border to
  `#8c8c8c` for this drawer only. The shift picker's unselected tiles darkened
  to match.

### Fixed — highlight copy was inverted (feedback 5)

The spec table settles the open item raised when this wording first landed:

| Copy | Counts |
|---|---|
| X unassigned **standby** in next 60 days | days where no employee is assigned standby duty |
| X unassigned **shift** in next 60 days | days where no employee is assigned an AM or PM shift |

The two labels had been applied in the order they were written in an earlier
review, which put "unassigned shift" on the standby count and "unassigned
roster" on the AM/PM count — backwards for both, and flagged as an open item at
the time rather than silently swapped. They now read `0 unassigned standby` and
`10 unassigned shift`, and "roster" is gone from the copy entirely.

### Changed — the day being edited keeps its colour (Xing Yun)

Edit mode greys every group bar, which made the mode obvious but also flattened
the day you are actually working on. The day open in the drawer now keeps the
full palette while the rest of the month stays grey, so the selection reads at a
glance. Verified on 6 Aug: before selecting, all four bars are `#f0f0f0`; once
selected they return to Standby blue, AM purple, PM periwinkle and On Leave
amber, while 5 Aug stays grey.

### Changed — status tag holds one position (feedback 3)

The On Leave / Absence tag sat inline after the name, so a long name pushed it
onto a second line and made that row taller than its neighbours. The tag is now
pinned to the right of the Employee cell and never shrinks; the name takes the
remaining width and truncates with an ellipsis, keeping the full text in a title
tooltip. The Employee column also took back the width the checkbox labels gave
up when those were removed.

Measured with a 57-character name injected into a tagged row: the tag's right
edge stays at the same x for every row, before and after, and the set of row
heights is unchanged.

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
| **Highlight pill wording is inverted** | Resolved 19 Aug — the spec table confirmed the swap; now "unassigned standby" and "unassigned shift". |
| **MOVE-3608 internal inconsistency** — the AC still says "3 leading and trailing read-only dates", "scrolled into view" and "employee ordering follows the defined employee status sequence", all leftovers from the matrix version the body no longer describes. Implementation follows the body. | Worth raising with the PM |

---

## Earlier history

Changes before the Roster module (Customer Contracts, Invoice, Customer
Notification, Live Tracking) predate this changelog. See `git log` and
`DEVELOPER_GUIDE.md` for the structural picture, and `CLAUDE_SESSION_CONTEXT.md`
for the PRD-derived business rules of those modules.
