# Figma Component Index

**Direction: code → Figma.** `FIGMA_DESIGN_SYSTEM.md` is read before building a
*screen* from an existing Figma design (Figma → code). This index is the
other direction: before pushing any UI **from this codebase into Figma**
("vibe code to Figma"), read this file first and reuse the listed component
— by its exact node — instead of drawing a fresh shape that merely looks
similar. A component built from scratch in Figma when a real one already
exists here is exactly the mistake this index exists to prevent.

> **How this gets filled in:** the user adds a row whenever they identify a
> Figma component that a piece of this app's UI should be built from. Claude
> fills in the "Key details Claude must know" column the first time that row
> is actually used for a code → Figma task — by calling `get_design_context`
> (or `get_metadata` first if the response looks sparse) on the node, per the
> `figma-design-to-code` skill, and reading its Code Connect note if it has
> one. That detail is then reusable on every later task, so it's read from
> Figma once, not re-derived per task.

---

## Index

| App element (code) | Figma component | Node / Link | Key details Claude must know | Notes |
|---|---|---|---|---|
| Sidebar (`layout/AppLayout.tsx`'s `Sider`) | "Side Navbar" (ATOM Business Component) | [node 425:16539](https://www.figma.com/design/ZpEYnJ4POb86CDMAM3BWCG/%F0%9F%92%8E-ATOM---Business-Component?node-id=425-16539) | Menu column width **230px**. Logo row: `px-16 py-20`, 24×24 ring "Symbol" + wordmark, gap 9px. Sidebar-collapse icon is `position: absolute, top:-1, right:-1` on the whole nav, not inline in the header row's flex flow. Avatar row: `Avatar` (32px) + `Badge dot` (6px, top:0/right:-2 relative to the avatar) + label, `gap-14`, row `py-4`. Flat item row: `h-40`, `pl-24 pr-16`, `gap-10` icon↔label, `itemBorderRadius` **8px**, `itemMarginBlock` **4px** (the gap between every row, top-level or not). A `Badge count={n}` (AntD default, `indicatorHeightSm` 14px) can sit on a bell icon the same way. Submenu: header row identical to a flat item plus a trailing chevron (`DownOutlined` collapsed / `UpOutlined` expanded — that direction, not the reverse); its children sit in a `submenuitembg` (`rgba(0,0,0,0.02)`) tinted area but **each child is still its own fully-8px-rounded row** at `pl-48`, with the same 4px gap as everywhere else — not one seamless joined block. | Implemented in `layout/AppLayout.tsx`. Menu content differs from the Figma example (ours: Leave, Personal Dashboard, Operations, Sales Module — theirs: Notifications, Roles & Permissions, Tenant, Staff, Operations); only the chrome/spacing was matched, per the user's explicit "only the menu adjusts to what we have" instruction. |
| Page-level top tab bar (`common/PageTabs.tsx`) | "Tab/Tab Group" (ATOM Business Component) | [node 424:16506](https://www.figma.com/design/ZpEYnJ4POb86CDMAM3BWCG/%F0%9F%92%8E-ATOM---Business-Component?node-id=424-16506) | Code Connect maps this to AntD `Anchor` with `direction="horizontal"`, **not** `Tabs` — every item carries its own underline segment (`Anchor`'s built-in horizontal ink-bar + the wrapper's own `::before` baseline), not a shared baseline + sliding bar. Items stretch to equal width (`flex:1 0 0`) — `Anchor` sizes to content by default, so that's the one deviation `PageTabs` adds. Optional "counter" variant is a `Badge / Basic` (AntD `Badge`) beside the label. | Implemented in `common/PageTabs.tsx`, used by `employeeportal/EmployeePortalPage.tsx`. See `FIGMA_DESIGN_SYSTEM.md` §3 for the fuller writeup. |
| Personal Dashboard — Leave tab, listing screen (`employeeportal/EmployeePortalLeaveTab.tsx`) | "HR General Screen" template (`41042:45004`) + "Leave" table component (`41042:54541`), cloned and content-edited — **not** hand-drawn | [Page 9, file 1FCRdGhHru6czP5P6h06kH](https://www.figma.com/design/1FCRdGhHru6czP5P6h06kH/%F0%9F%91%A9%F0%9F%8F%BB%E2%80%8D%F0%9F%9A%80-Personal-Dashboard---HR-Module-?node-id=41021-32512) — frame node `41048:645` | Rebuilt from the file's real listing template + table (user pointed at `41042:45003` template, `41042:48106` filled example, `41042:54541` table and asked the earlier hand-drawn version be redone from these). Tab bar trimmed from the template's 7 generic tabs to the real 4 (Home, **Leave** active, Claims, Pay Slip) — required `detachInstance()` on `Tab/Tab Group` first, since an instance's own children can't be added/removed directly. 3 cards cloned from the filled example's populated card (title row + real table instance), not the raw template's `{{CONTENT}}` placeholder: Leave Applications (5 col × 4 rows), Leave Balances (6 col × 6 rows), Pending My Approval (6 col × 2 rows) — column counts/widths and row counts adapted per card, content pulled from `leave/leaveData.ts` (Citra Dewi / `lv-3` as self). See `FIGMA_DESIGN_SYSTEM.md` §4.1 for the full rebuild method, the 6-cell-per-row column-order gotcha, the compound last-column-cell gotcha, and a `get_screenshot` staleness caveat hit while verifying this. | Supersedes the earlier hand-drawn `41038:6` (left in place, renamed "SUPERSEDED", not deleted — delete once a normal Figma open visually confirms `41048:645`, since the stale-screenshot issue meant this session couldn't get a trustworthy final screenshot). Drawers (Apply for Leave `41040:6`, Details `41039:89`) are unchanged — the user's template/table pointer was specifically about the listing screen. Claims and Pay Slip screens still not pushed — do those next if asked to continue "everything in Personal Dashboard." |
<!-- next row: | <element> | <Figma component name> | <node link> | <fill in when first used for a code→Figma task> | -->

---

## Maintenance

- A row with an empty "Key details" column is a component the user has
  pointed at but Claude hasn't yet read from Figma — read it (via
  `get_design_context`, `skillNames` including `figma-design-to-code`)
  before using it for a code → Figma task, then fill the column in.
- If a component's Figma definition changes (variants, tokens, Code Connect
  target), update its row in the same change that notices the drift — same
  rule every other doc here follows.
