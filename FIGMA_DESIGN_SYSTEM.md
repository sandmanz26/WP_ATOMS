# Figma Design System Reference

This document exists so design decisions made in Figma travel into the code
(and back) instead of being re-guessed every time. It is a **living reference,
not a one-time note** — whoever owns the design system fills in the sections
below, and whoever writes code or Figma designs reads them first.

> **How this gets used:** before building a new screen or component, read the
> relevant sections here — tokens, the component mapping table, naming rules —
> and match them. When something here goes stale (a token renamed, a
> component's Figma variants changed), update this file in the same change
> that causes the drift, the same rule `CHANGELOG.md` follows.
>
> **This file is Figma → code.** Going the other way — pushing this app's UI
> *into* Figma — reads `FIGMA_COMPONENT_INDEX.md` instead, so an existing
> library component gets reused rather than a fresh one-off getting drawn.

Everything below is a **template**. Sections marked `<!-- fill in -->` are
empty on purpose — they get their real values from whoever maintains the
Figma file, not invented from the code side. Where a section already has
content, it was read directly from Figma or from a ticket and is safe to
build from; anything not filled in here should not be assumed or guessed —
ask, or read the live Figma file for that one thing.

---

## 1. Figma files

| File / Library | Link | What it covers |
|---|---|---|
| "💎 ATOM - Business Component" | `https://www.figma.com/design/ZpEYnJ4POb86CDMAM3BWCG/%F0%9F%92%8E-ATOM---Business-Component` | The shared business-component library (e.g. `Tab/Tab Group`, `Side Navbar`, `FilterBar 3.0`, §3). **Always check this file first** when a screen needs a component that isn't a plain AntD primitive — it's the one confirmed shared library so far. |
| "👩🏻‍🚀 Leave - HR Module" | `https://www.figma.com/design/VYGulw8yaudo3FRAWh4sEh/%F0%9F%91%A9%F0%9F%8F%BB%E2%80%8D%F0%9F%9A%80-Leave---HR-Module-` | Real screens for the Leave epic (MOVE-3410) — a different file from the Business Component library above. The **data table** spec in §3.3 was read from here (its Leave listing table) and applies app-wide, not just to Leave. |
| "👩🏻‍🚀 Personal Dashboard - HR Module" | `https://www.figma.com/design/1FCRdGhHru6czP5P6h06kH/%F0%9F%91%A9%F0%9F%8F%BB%E2%80%8D%F0%9F%9A%80-Personal-Dashboard---HR-Module-` | Real screens for the Personal Dashboard epic (MOVE-3412) — a third file, distinct from both of the above. The **Drawers Template / form field-row** spec in §3.4 (the "Create Leave Type" component, nodes `39283:133569` / `39282:89715`) was read from here. |
<!-- fill in the rest -->
| e.g. "WLA Design System" | `https://figma.com/design/...` | Core tokens, base components |

**Which file is the source of truth for tokens vs. for screens?**
<!-- fill in — if they're different files, say which wins when they disagree -->

---

## 2. Design tokens

Fill in actual values (hex codes, px, font names) — not "primary blue", the
literal value, so it can be pasted into code without re-deriving it.

### 2.1 Color

| Token name (in Figma) | Value | Used for | AntD equivalent (if any) |
|---|---|---|---|
<!-- fill in, e.g. -->
| `color/primary/600` | `#____` | Primary buttons, links, active nav | `token.colorPrimary` |
| `color/success` | `#____` | Approved / success states | `token.colorSuccess` |
| `color/warning` | `#____` | Pending states | `token.colorWarning` |
| `color/danger` | `#____` | Rejected / destructive actions | `token.colorError` |
| `color/text/primary` | `#____` | Body text | `token.colorText` |
| `color/text/secondary` | `#____` | Secondary/muted text | `token.colorTextSecondary` |
| `color/border` | `#____` | Dividers, table borders | `token.colorBorder` |
| `color/bg/layout` | `#____` | Page background | — |

> Note: this codebase currently sets colors ad hoc via inline `style` (e.g.
> `#1a1a1a`, `#8c8c8c`, `#f5f5f5` scattered across files) rather than through
> AntD's `ConfigProvider` theme tokens. Once this section is filled in, the
> right follow-up is deciding whether to centralize these into a theme config
> — flag that as a separate task, don't fold it into an unrelated ticket.

### 2.2 Typography

| Token name | Font family | Size | Weight | Line height | Used for |
|---|---|---|---|---|---|
<!-- fill in -->
| `heading/h2` | | | | | Page titles |
| `heading/h4` | | | | | Card/section titles |
| `body/regular` | | | | | Default body text |
| `body/small` | | | | | Table cells, secondary labels |

### 2.3 Spacing scale

<!-- fill in — e.g. 4 / 8 / 12 / 16 / 20 / 24 / 32, and which one is the
     default page gutter, card padding, gap between stacked sections, etc. -->

- Page gutter (left/right edge of content): `24px` (confirmed — see `padding:
  24` convention in every page component, e.g. `LeavePage.tsx`)
- Card internal padding: <!-- fill in -->
- Gap between stacked cards/sections: <!-- fill in -->
- Gap between inline items (buttons in a toolbar, tags in a row): <!-- fill in -->

### 2.4 Radius & shadow

<!-- fill in -->
- Card / drawer / modal corner radius:
- Button corner radius:
- Card shadow (if any):

### 2.5 Breakpoints

<!-- fill in, if the Figma file designs for more than one viewport width.
     This codebase is currently desktop-only (fixed 250px sidebar, no
     responsive breakpoints) — note here if that's intentional or a gap. -->

---

## 3. Component mapping (Figma → Ant Design)

The rule: **don't hand-roll a component AntD already provides** unless the
Figma design deviates from AntD's default in a way that matters. This table
is where "it deviates" gets written down, so the deviation is a decision, not
a drift.

| Figma component | AntD component used in code | Deviation from AntD default | Notes |
|---|---|---|---|
<!-- fill in as components come up, e.g. -->
| `Button/Primary` | `Button type="primary"` | none | |
| `Status Tag` | `Tag` | Custom color map per status (see `STATUS_TAG_COLOR` in `leave/LeaveApplicationDrawers.tsx`) | Figma's status colors should match this map — flag if they don't |
| `Table/Data Table` | `Table` | `size="small"`, no zebra striping | |
| `Drawer/Form` | `Drawer` + `Form` | Width fixed per drawer (`480`/`520`), not responsive | |
| `Empty State` | `Empty` | `image={Empty.PRESENTED_IMAGE_SIMPLE}` everywhere, never the default illustration | |
| `Tab/Tab Group` (ATOM Business Component, [node 424:16506](https://www.figma.com/design/ZpEYnJ4POb86CDMAM3BWCG/%F0%9F%92%8E-ATOM---Business-Component?node-id=424-16506)) | `common/PageTabs.tsx` (wraps `Anchor`, **not** `Tabs`) | The component's own Code Connect note maps it to AntD `Anchor` with `direction="horizontal"` — every tab item carries its own underline segment (colored active / faint default), not `Tabs`' shared baseline + ink bar. `PageTabs` adds one real deviation: items are stretched to equal width (Anchor sizes to content by default) to match the Figma spec. **Always use `PageTabs` for a page-level top tab bar** — this was called out explicitly as a standing rule, not a one-off. | Used in `employeeportal/EmployeePortalPage.tsx`'s Home/Leave/Claims/Pay Slip bar. Not yet retrofitted onto other pages' top-level tab bars (e.g. Claims' own "My Claims"/"Pending My Approval" sub-tabs still use plain `Tabs` — that's a nested in-panel toggle, arguably a different case, but worth a call if this component is meant to cover that shape too). |
| `Side Navbar` (ATOM Business Component, [node 425:16539](https://www.figma.com/design/ZpEYnJ4POb86CDMAM3BWCG/%F0%9F%92%8E-ATOM---Business-Component?node-id=425-16539)) | `layout/AppLayout.tsx`'s `Sider` | See `FIGMA_COMPONENT_INDEX.md` for the full token breakdown (item height/radius/margin, sub-item indent and tint) — kept there rather than duplicated here since that file is the one read before any further sidebar work. | An earlier pass joined an expanded section's sub-items into one seamless block; the real component keeps each sub-item independently, fully rounded, with the same small gap as every other row — just tinted and indented further. Fixed once actually read from Figma instead of a screenshot alone. |
| `FilterBar 3.0` (ATOM Business Component, [node 21:9490](https://www.figma.com/design/ZpEYnJ4POb86CDMAM3BWCG/%F0%9F%92%8E-ATOM---Business-Component?node-id=21-9490)) | No single AntD component — a composable toolbar row, see §3.2 | Not built from yet; recorded ahead of an explicit request ("bisa jadi saya akan minta kamu... di leave module") so the slot breakdown is ready when asked for. | The row already under `LeavePage.tsx`'s title (Last Updated On + Search Employees) is this component's shape, arrived at independently — see §3.2 for whether it matches slot-for-slot. |

### 3.2 Table toolbar (`FilterBar 3.0`) — a composable row, not a single component

Sits directly under a page's title (see §3.1) whenever that page's table has
its own filters/actions — **not on every page**, per the user: "tidak selalu
tergantung module nya apa" (not always, depends on the module). It is a bag
of optional slots, each an existing AntD primitive, laid out `display:flex,
gap:8px, alignItems:center`, every control **32px tall**:

| Slot (Figma prop) | AntD equivalent | Notes |
|---|---|---|
| `noEmpty` — Date Selector | `<Text>{label}:</Text>` + `<DatePicker.RangePicker />` | Label right-aligned, colon at 2px/8px inline margins. Default example label "Last Updated"; `secondaryDatepicker` (version 2.0 only) adds a **second** one before the search box, own label (e.g. "Date Announcement") — two independent range filters, not one. |
| `search` — Table Query Searchbar | `<Input placeholder="Search for X.." />` | Fixed width **222px**. |
| `filterIcon10` / `filterIcon20` — Table Filter with Buttons | `<Button icon={<FilterOutlined />} />` | Icon-only, 32×32. Two Figma variants (`10`/`20`) render identically in this instance — likely alternate states/contexts, not a visual difference worth encoding until a second real case shows one. |
| `downloadButton` | `<Button icon={<VerticalAlignBottomOutlined />} />` | Icon-only. |
| `downloadButtonAlt` | `<Button icon={<VerticalAlignBottomOutlined />}>Download Trip</Button>` | Same icon, with a label — pick one per context, not both. |
| `secondaryButton` | `<Button>{label}</Button>` | Default-style button; this instance's example label is "Cancel" but the attached `showMenu` state (a floating option list — "Route" / "Route Point") shows it can also act as a dropdown trigger, not literally a cancel action. Read the actual use before assuming which. |
| trailing primary button (always present when `version` renders) | `<Button type="primary" icon={<PlusOutlined />}>Create new <DownOutlined /></Button>` | The chevron implies a dropdown of create options, not a plain click — pair with AntD `Dropdown` if the real use needs one. |

**Component-file quirk, not necessarily to replicate**: the default/secondary
buttons use `borderRadius: 6` (`button/global/borderRadius`) while the
"Cancel" and primary "Create new" buttons use `8` (`modal/global/
borderRadiusLg` — a modal token, reused here, probably a copy/paste
artifact rather than an intentional two-radius button system). Flag this if
it ever produces a visibly inconsistent row rather than copying it
blindly.

**Already built independently, not yet reconciled against this component**:
`LeavePage.tsx`'s toolbar (`Last Updated On :` + `RangePicker` + `Search
Employees` `Input`) is the same shape as the `noEmpty` + `search` slots
above, arrived at before this component was read from Figma. Worth a pass
to confirm it lines up control-for-control (32px height, 8px gaps, 222px
search width) next time that page is touched, rather than assumed.

**When Figma introduces a new component not in this table**: before writing
custom UI for it, check whether it's actually a variant of something AntD
already ships (most "custom" cards/badges/toggles usually are). Add the row
here once it's settled either way.

### 3.1 Page header (standing structural rule, not a single component)

**Every page's header is a small breadcrumb trail, then a large bold title
directly beneath it — enforced from `layout/AppLayout.tsx`'s `pageTitle`
prop, not left to each page to reimplement.** Confirmed against a reference
screenshot (Figma dev-mode inspect, no shared link this time): a Roster
listing page whose breadcrumb reads "Roster" but whose title reads
"Operations Roster" — **the sidebar section name gets prefixed onto the page
name** for anything grouped under a collapsible section (Operations, Sales
Module); flat top-level items (Leave, Personal Dashboard) use just their own
name.

- Pass `pageTitle="..."` on every `<AppLayout>` call in `App.tsx`; do not
  also render the page's own duplicate `<Title>` — delete it (see the same
  commit that added this rule for the full list of pages migrated).
- **Exception — pages with their own dynamic detail header** (a record's
  name/number, often beside a status tag or actions — `ContractDetailPage`,
  `InvoiceDetailPage`/`InvoiceDetailTesting2Page`,
  `CustomerNotificationDetailPage`, `LeaveProfilePage`) leave `pageTitle`
  unset and keep their bespoke inline header. That's a different shape
  entirely, not a page-listing header — forcing it through `pageTitle` would
  mean flattening out the tag/action row beside it for no visual gain.
- **Exception — `CustomerNotificationPage`** also keeps its own inline
  title: which text to show depends on an internal `surface` toggle (the
  hidden driver-leave / personal-dashboard prototypes riding along behind
  it) that `App.tsx`'s route can't see.
- A page-level primary action button that used to sit inline beside the old
  per-page title (e.g. Manage Leave Types' "Create Leave Type") moves to sit
  alone, right-aligned, in the page's own content — not into `topBarRight`
  (that slot sits next to the *breadcrumb*, a level up, and is really for
  page-level navigation like "Return to X", not a content action).

### 3.3 Data table — read from the Leave module's own Figma file, applies app-wide

**Use `common/DataTable.tsx` for every new standard listing table.** It
wraps the bordered/radius-8 card and, when a `toolbar` is passed, glues it to
the top of that same card with a divider — never a toolbar floating in its
own row above a separately-bordered table, which is what `LeavePage.tsx` did
before this was corrected. Built explicitly so "the same table component" is
true going forward, not just a shared spec every page re-implements by hand.
Migrated so far: `LeavePage.tsx`. Not yet retrofitted onto the other pages
listed in the table below (Invoice, Customer Contracts, etc.) — they already
match most of this spec independently (see the per-file fixes two commits
back) but still hand-roll their own wrapper div rather than using the shared
component; worth doing next time one of them is touched.

Read from the "👩🏻‍🚀 Leave - HR Module" file's Leave listing table (§1) —
this is a **different Figma file** from the ATOM Business Component library
that §3.1/§3.2 came from, but the same table shape is used everywhere in
this app, so the spec applies globally, not just to Leave.

| Property | Value | Where it's enforced |
|---|---|---|
| Cell padding | **16px block, 16px inline** (`cellPaddingBlock`/`cellPaddingInline`) | AntD `Table`'s *default* size already is this — the fix was **removing `size="middle"`** (which reads the 12px/8px `...MD` tokens instead) from every main listing table, not adding a token override. |
| Row height | 54px for a single-line cell (16 + 22 line-height + 16) | Falls out of the padding + `Typography`'s line-height once the size prop above is corrected; a cell with its own two-line content (e.g. a "time ago" caption under a date) is taller by design, not a bug. |
| Border color | `#f0f0f0` (`components/table/component/bordercolor`) | Already correct almost everywhere via `main.tsx`'s `ConfigProvider` Table token; one page (`CustomerContractsPage.tsx`) had drifted to `#e8e8e8` and was corrected to match. |
| Header background / text | `#fafafa` bg, **`rgba(0,0,0,0.88)`** text, **font-weight 600** | `headerColor` in `main.tsx`'s `ConfigProvider` was `#595959` (a judgment call made before this was read from Figma) — corrected to the exact token. Font-weight has no Table component token in AntD, so it's a global CSS rule in `index.css` instead. |
| Column divider | A 0.5–1px vertical line at each header cell boundary | Was reinvented three times independently as page-scoped `<style>` blocks with three different class names (`leave-table`, `notif-table`, `invoice2-table`) before this was traced to one Figma spec — consolidated into one global rule in `index.css`, removed from every page that had its own copy. |
| Table container | White bg, `1px solid #f0f0f0` border, **8px** radius, `overflow: hidden` | Every main listing table already wrapped itself this way independently; the radius was consistently `10px` (another pre-Figma judgment call) — corrected to `8px` app-wide. |

**Deliberately not touched**:
- Tables using `size="small"` (trip lists inside drawers/detail-page nested
  cards, month-usage tables, etc.) — this spec is for the page-level "Main"
  listing table (the Figma instance's own `table` prop is literally
  `"Main"`), not every nested compact list. Bumping those to 16/16 padding
  would blow out drawer layouts for no benefit the reference asked for.
- `personaldashboard/PersonalDashboardLeaveTab.tsx` — excluded per a
  standing, explicit instruction to leave that file alone (it's slated for a
  separate rebuild), even though its three tables still say `size="middle"`.
- Per-cell inline font sizes (many cells render `<Text style={{ fontSize:
  13 }}>` where the spec calls for 12px) — inline styles win over any CSS
  rule, so a real fix means editing each column's `render` function, not a
  global rule. Not done in this pass; flagged here rather than silently
  left inconsistent.

### 3.4 Drawers Template / form field-row pairing — read from "Personal Dashboard - HR Module"

Read from the "Create Leave Type" business component (§1, nodes
`39283:133569` / `39282:89715`) while auditing `LeaveTypeDrawers.tsx` against
it. Applies to every drawer built from the same vertical-form pattern
(`_Form / Form Item / Vertical` fields stacked in a `Drawer`), not just Leave
Type — check a new form drawer against this before inventing its row layout.

| Property | Value | Where it's enforced |
|---|---|---|
| Field row pairing | Two related fields that fit side by side (e.g. a name + its own entitlement-like field) sit in the **same row**, not stacked as two full-width fields | `CreateLeaveTypeDrawer`'s Leave Type + Entitlement were two stacked full-width `Field`s before this was read from Figma; now a `grid-template-columns: 1fr 1fr` row, 12px gap. |
| Date-range row gap | **16px** between two fields that are always a pair (e.g. Effective Date / End Date) | Was `12px` (a guess) in both `CreateLeaveTypeDrawer` and `EditLeaveTypeDrawer`; corrected to the measured Figma gap in both. |
| A number input + its unit selector | Two **independently-rounded** controls with an **8px** gap — not an AntD `Space.Compact` merged-border pair | Both drawers used `Space.Compact` (square inner corners) before this was read; now a plain flex row, `gap: 8`, each control keeping its own `border-radius`. |
| Single-choice field with >2 options | A `Select` (dropdown), not a `Radio.Group` list, once there are more than 2 options | `Employee Eligibility` (4 options) was a `Radio.Group` — wrong independently of Figma, since `MOVE-3221`'s own field table says "Dropdown"; the Figma component confirms it as a single-select combobox. `Supporting Document` (2 options, Required/Optional) correctly stays `Radio.Group` — Figma and the ticket both still call it Radio there. |
| Drawer width / outer padding | Figma's own frame reads 684px wide with 32px padding | **Deliberately not copied onto the `Drawer` width.** Every drawer in the app (17+ call sites) uses the established 480/520 convention; this looks like the mockup canvas size for this one component, not an instruction to widen every drawer in the app. Only the internal field layout above was corrected. |
| Invalid-submit feedback | A `message.error` toast, in addition to whatever inline field error already existed | Found missing on `EditLeaveTypeDrawer`, `CreateClaimDrawer` (Personal Dashboard Claims) and `CreateLeaveApplicationDrawer` (Personal Dashboard Leave) — each already had inline field states but no toast. Added to all three, same `message.error` pattern already used elsewhere in the app (`CreateGroupModal.tsx` etc.). |

**Applied beyond Leave Type**, on request, to the two "Create X" form drawers
in Personal Dashboard:

- `employeeportal/EmployeePortalClaimsDrawers.tsx`'s `CreateClaimDrawer` —
  Receipt Date/Receipt Time were sitting in a plain `<Space>` (each control at
  its own intrinsic width) rather than an evenly-split row — converted to the
  same `grid-template-columns: 1fr 1fr`, 16px-gap shape as Effective Date /
  End Date above.
- `employeeportal/EmployeePortalLeaveDrawers.tsx`'s `CreateLeaveApplicationDrawer`
  needed more than a gap fix: its own ticket (`MOVE-3946` §2) says outright
  "all fields and logic same as apply leave drawer in leave module
  (`MOVE-3777`)", but it had drifted onto a single `DatePicker.RangePicker`
  under one "Leave Application Period" label, with a separate, disconnected
  AM/PM-only row below — not the two-column Start Date / End Date (each
  paired with its own AM/PM half) that `leave/LeaveApplicationDrawers.tsx`'s
  `ApplyLeaveDrawer` already has. Rebuilt to match: two `Form.Item`s in a
  `1fr 1fr` grid, each wrapping a `noStyle` date field + half-day `Select` in
  an 8px-gap flex row; every field but Leave Type disabled until a type is
  picked; the end date clears when the start date changes; the balance
  preview shows Available / To Deduct / Balance per year, not a bare single
  "Deduction" line. A user screenshot of the still-old drawer is what caught
  this — the earlier "just fix the gap" pass had read the file's own
  isolation note (no shared component with the HR drawer) as license to leave
  the field *shape* alone, which was wrong: isolation means no shared code,
  not a different shape than the ticket specifies.

Their AM/PM half-day fields stay `Select` (now matching the HR drawer, not
`Radio.Group`), and the Leave-Type/Claims-Type fields were already `Select`,
so no change was needed there.

---

## 4. Figma file conventions

**"👩🏻‍🚀 Personal Dashboard - HR Module" (`1FCRdGhHru6czP5P6h06kH`) page structure** — read via a page-discovery `use_figma` call before building anything here:

| Page | Holds |
|---|---|
| `🧩 Component` | The file's local component library — Button, Select, DatePicker, Radio, Tag/Status, Input/Textarea, Upload/Button, Form Label/Item Vertical, Tab/Tab Group, Detail Page Template, and feature-specific sets like `Apply Leave`, `Create Leave Type`, `Leave Type Detail Drawer`, `Employee`. These are **local** components (not an imported team library — `get_libraries` on this file shows no business-component library added), so reuse them by `findOne`/traversal within this file, not `importComponentByKeyAsync` against a remote library. |
| `🏭 Production` | Finished screens built from those components — includes multiple `Apply Leave` and `Create Leave Type` instances, and a `Leave Listing` full-page screen (sidebar + table). |
| `🧑‍🍳 Kitchen` | Work-in-progress screens, not yet promoted to Production. |
| Numbered pages (e.g. `Page 9`) | Blank pages the user hands over as a target for a specific code→Figma task — check `get_metadata` on the given node-id first; a `<canvas>` with no children means "build here." |

**Code→Figma pushes land in their own page/frame, not inside Production/Kitchen**, unless the user says otherwise — see `FIGMA_COMPONENT_INDEX.md`'s entry for exactly what was pushed to `Page 9` and why the pre-existing `Apply Leave` component there was deliberately left untouched.

**Critical `use_figma` gotcha found in this file — "SF Pro" does not rasterize for new text nodes.** Existing component instances in this file use "SF Pro" (Semibold/Regular) and it renders fine for them, and `figma.loadFontAsync({family:"SF Pro",...})` succeeds with no error — but any **new** `figma.createText()` node given that font reports `width: 0` forever (even after explicitly setting `layoutSizingHorizontal = 'HUG'` or calling `.resize()`), and renders as **fully invisible** in `get_screenshot` — structurally correct frames/tables/buttons all render, only the text glyphs are silently blank. Confirmed via `figma.listAvailableFontsAsync()` that "SF Pro" "Regular"/"Semibold" are listed (so it's not a missing-font-name issue) — the font just doesn't rasterize for plugin-created content in this environment. **Switch to `{family:"Inter", style:"Regular"}` / `{family:"Inter", style:"Semi Bold"}`** for any text created via `use_figma` — confirmed working (auto-measures correctly, renders correctly) with otherwise-identical code. Re-check this with a one-node smoke test (`createText`, set font+characters, read `.width` — non-zero means it works) before a big build if a different file/font is involved; don't assume it's fixed just because `loadFontAsync` didn't throw.

**4.1 Rebuilding the Leave listing screen from the real "HR General Screen" template + table, not hand-drawn primitives.** The first Leave-tab push (§ above, frame `41038:6`) was hand-drawn with manual auto-layout — acceptable for a first pass, but the user later pointed at the file's actual listing template (`41042:45004`, "HR General Screen", inside top-level "Frame 1" `41042:45003`), its filled example ("Manage Leave Types", `41042:48107`), and its table component (`41042:54541`, "Leave") and asked for the hand-drawn version to be rebuilt from those real components instead — this is exactly the `figma-fidelity` skill's "use the real structure, don't approximate it" rule applied to a Figma-side build, not just a code-side one. The rebuild (new frame, same page: `41048:645`) works like this:

- **Clone the raw template** (`41042:45004`, keeps the `Tab/Tab Group` instance) as the screen shell, rather than the filled example — the filled example has its tab bar *removed*, not just hidden, for that variant.
- **The `Tab/Tab Group` instance cannot have its children added/removed directly** — Figma disallows structural `remove()`/`clone()` on an *instance's* children (only on a plain frame's). Fix: `tabGroup = tabGroup.detachInstance()` first (converts the wrapper to a frame; its own nested `Tab/Tab Item` instances stay full instances and remain freely clonable/removable), *then* trim/clone/reorder tabs. Reorder with `insertChild(0, node)`, not by hand-setting `.x` — the group is an auto-layout (`HORIZONTAL`) frame with fill-sized children, so manual `.x`/`.resize()` on children is silently overridden by the next layout pass; only child *order* and *count* are yours to control.
- **Clone the filled example's populated card** (`41042:48118` — title row + real `Table`-component instance, not the empty-state "Custom Leave Types" card) once per card needed (3×: Leave Applications, Leave Balances, Pending My Approval), instead of trying to hand-fill the raw template's `{{CONTENT}}` placeholder slots.
- **The table's header row and each data row hold 6 cell instances, not 5** — a `_Table / Table Item / Header Item` (header) / `Table / Table cell` (data) per column, where column 5 and column 6 swap which index is hidden vs visible between the header row and the data rows (a pre-existing authoring quirk, not something the rebuild introduced). Don't assume a fixed array index is "the hidden one" — filter by `.visible !== false` and sort the remainder by `.x` to get a reliable left-to-right column order, for both the 5-visible-column and the unhide-the-6th-for-a-6-column-table cases.
- **A table cell's rendered text can come from more than one text node even when `get_metadata`/a tree-walk shows exactly one.** The last-column cell in the source table is a "Last Updated On" archetype (`componentProperties` include `Text Content` *and* `Text 2 Content`, a `Tag 2` boolean, icon toggles) with a secondary relative-time subtext line (`"16 Days ago"`) living as a sibling of the primary text, not nested under it — set both `Text Content` *and* hide/replace the secondary line's node (or it leaks the source table's "X Days ago" placeholder into an unrelated column like "Status"/"Remaining").
- **`get_screenshot` (the official Figma MCP) looked stale/wrong after this rebuild, both to this session and to the user's own open Figma tab** — see §4.2, this turned out to be a real, resolved finding, not just "give it a minute."
- `41038:6` (the old hand-drawn listing) and `41039:89` (the old hand-drawn details drawer) have since been **deleted**, once §4.2's fix made a trustworthy screenshot possible — see the next entry and `FIGMA_COMPONENT_INDEX.md`.

**4.2 Two different Figma MCP servers in this session gave genuinely different answers about the same file — prefer the Figma Desktop Bridge plugin (`mcp__Figma_Southleft__*`) for anything in this file, per explicit user instruction.** After the §4.1 rebuild, the user sent a screenshot of their own Figma tab showing the breadcrumb/title/tabs still as `{{Title}}`/`{{Module Name}}`/`Current Route` placeholders — while this session's own `node.characters` reads (via the official `mcp__Figma__use_figma`) consistently reported the correct new content, and even a from-scratch full-text-node dump of the frame (100 text nodes) showed nothing placeholder-shaped anywhere. Both couldn't be right. Once the user re-paired the **Figma Desktop Bridge** plugin (`mcp__Figma_Southleft__*`, a separate MCP server from the official `Figma` one — see the Key Technical Concepts distinction elsewhere in this session) and asked that it be used from then on, its `figma_capture_screenshot` (which calls the plugin's own `exportAsync`, i.e. renders from the live document the user has open, not a server-side export pipeline) showed the **correct** content immediately and consistently, matching every property read. Practical takeaways for this file going forward:
  - **Use `mcp__Figma_Southleft__figma_execute` for writes and `figma_capture_screenshot` for verification in this file**, not the official Figma MCP's `use_figma`/`get_screenshot` — confirmed reliable where the official MCP's screenshot tool was not, for reasons this session could not fully pin down (possibly a server-side render/export cache on the official MCP's side that lags behind rapid plugin-driven edits; possibly specific to this file/session). Re-pair with `mcp__Figma_Southleft__figma_pair_plugin` (returns a 6-character code, expires in 5 minutes, entered into the Desktop Bridge plugin's Cloud Mode toggle) whenever `figma_diagnose` reports the bridge disconnected.
  - **`figma_execute` cannot resolve a deeply-nested compound instance node ID directly** (e.g. `getNodeByIdAsync("I123:456;789:10;...")` on a long chain reliably timed out at 5–30s) — fetch the nearest real top-level ID instead and reach the target by `.children.find(...)`/a small recursive walk from there. This is the opposite of the official MCP, which resolved those same compound IDs instantly — another data point that the two servers' plugin execution environments are not equivalent for this file.
  - **A single `figma_execute` call doing many `figma.loadFontAsync` calls (one per text edit) can itself time out** — cache loaded fonts by `family|style` in a `Set` within the script and only call `loadFontAsync` once per unique font, rather than once per text node.
  - The same `detachInstance()`-before-structural-edit rule from §4.1 applies here too (hit again when cloning a second `RT-Details Content Sub-Section` into the `Drawers Template` instance for the drawer rebuild below).

**4.3 Rebuilding the Leave Application Details drawer from the real "Leave Type Detail Drawer" template, after the code itself was found not to match it.** The user pointed at `41060:69354` ("Leave Type Detail Drawer", built from the `Drawers Template` component, `41060:69367`) as what this drawer's structure should look like — a bold section header ("Basic Information" / "Additional Information") followed by 2-column `Group Content Cell` rows (label above bold value, two per row, divider between rows), with several further `Group Content Cell`s per section pre-built but hidden, ready to be shown when there's more data to display. `EmployeePortalLeaveDrawers.tsx`'s `LeaveApplicationDetailsDrawer` was using AntD `Descriptions column={1} bordered` instead — a single-column bordered table, a different shape entirely, not just a styling gap. Fixed in both places:
  - **Code**: added `DetailRow`/`DetailCell` plus `LBL`/`VAL`/`SECTION_TITLE` style constants to `EmployeePortalLeaveDrawers.tsx`, matching the label/bold-value/divider pattern already used by `ContractDetailPage.tsx` and others in this codebase (so this was reusing an existing app-wide convention, not inventing a new one) — see the Leave Application row in `FIGMA_COMPONENT_INDEX.md` for the exact field/row breakdown and the status-dependent hide/show logic (Approved/Rejected/Cancelled each reveal a different extra row, Employee always shows last).
  - **Figma**: cloned `41060:69354`, then cloned its one `RT-Details Content Sub-Section` a second time (`detachInstance()` on `Drawers Template` first — same instance-children restriction as §4.1/§4.2) to get two sections, retitled "Basic Information" / "Additional Information", filled their `Group Content Cell → Content Cell → Label/Value` pairs, and hid the unused extra cells (left available, matching the code's own hide/show). The header's action button already carries `Type`/`Danger` variant properties — set `Danger: "True"`, `Type: "Default"` to match the code's `<Button danger>Cancel Leave</Button>`, rather than overriding fill colors by hand. Also hid each content cell's own `Sub-body content wrapper` ("X ago" relative-time subtext) since the code doesn't render that — keeping the mockup honest about current code, not more polished than it.

<!-- fill in further as discovered:
     - Variant naming convention (e.g. `state=default/hover/disabled`)
     - Any boolean/instance-swap props worth knowing about
-->

---

## 5. States & interaction patterns

<!-- fill in the standard treatment for these, so every new drawer/table/form
     doesn't reinvent them: -->

| State | Standard treatment |
|---|---|
| Empty (no rows/data) | `Empty` with `PRESENTED_IMAGE_SIMPLE`, one-line description |
| Loading | <!-- fill in — this codebase has no backend/async, so likely N/A. Confirm. --> |
| Disabled action (e.g. Confirm button pending required input) | Grey out the button (`disabled`), never hide it |
| Error / validation | AntD `Form` inline validation messages; red text under the field |
| Destructive action confirmation | `Modal` with `danger` OK button, required reason for the more consequential action (e.g. Reject needs a reason, Cancel does not — see MOVE-3893/3779) |

---

## 6. Icons

<!-- fill in -->
- Icon set used in Figma:
- Mapped to `@ant-design/icons` in code — confirm 1:1 coverage, or list gaps:
- Default icon size in menus / buttons / table actions:

---

## 7. Known deviations (code ahead of / behind Figma)

Use this section to track places where the code and Figma currently disagree
on purpose or by accident — so it's a tracked list, not something rediscovered
during the next Figma-vs-code comparison pass.

<!-- fill in, e.g. -->
- <!-- ticket / area --> — code does X, Figma shows Y, because <!-- reason -->.
- `MOVE-3221`/`MOVE-3559` drawers (`LeaveTypeDrawers.tsx`) — code uses the
  app-wide 480/520 drawer-width convention; the "Create Leave Type" Figma
  component's own frame is 684px wide with 32px padding. Treated as that
  component's mockup canvas size, not a width to copy — see §3.4.

---

## Maintenance

- Whoever changes a token or component pattern in Figma updates this file in
  the same pass, the same way `CHANGELOG.md` gets a same-commit entry for
  code changes.
- When Claude is asked to build a screen or component against Figma, this
  file is read first; gaps found while building get filled in as part of
  that work, not left for later.
