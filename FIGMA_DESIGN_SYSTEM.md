# Figma Design System Reference

This document exists so design decisions made in Figma travel into the code
(and back) instead of being re-guessed every time. It is a **living reference,
not a one-time note** — whoever owns the design system fills in the sections
below, and whoever writes code or Figma designs reads them first.

> **How this gets used:** before building a new screen or component, read the
> relevant sections here — tokens, the component mapping table, naming rules —
> and match them. Before pushing a new pattern into Figma from code, check
> here first so a new one-off doesn't get invented where an existing token or
> component already covers it. When something here goes stale (a token
> renamed, a component's Figma variants changed), update this file in the same
> change that causes the drift, the same rule `CHANGELOG.md` follows.

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
<!-- fill in -->
| e.g. "WLA Design System" | `https://figma.com/design/...` | Core tokens, base components |
| e.g. "WLA — Leave Module" | `https://figma.com/design/...` | Screens for the Leave epic (MOVE-3410) |

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

**When Figma introduces a new component not in this table**: before writing
custom UI for it, check whether it's actually a variant of something AntD
already ships (most "custom" cards/badges/toggles usually are). Add the row
here once it's settled either way.

---

## 4. Figma file conventions

<!-- fill in how the Figma file itself is organized, so reading it is fast:
     - Are components built with Auto Layout? (assume yes unless told otherwise)
     - Variant naming convention (e.g. `state=default/hover/disabled`)
     - Which page/frame holds the component library vs. which holds screens
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

---

## Maintenance

- Whoever changes a token or component pattern in Figma updates this file in
  the same pass, the same way `CHANGELOG.md` gets a same-commit entry for
  code changes.
- When Claude is asked to build a screen or component against Figma, this
  file is read first; gaps found while building get filled in as part of
  that work, not left for later.
