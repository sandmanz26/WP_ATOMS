---
name: figma-fidelity
description: "MANDATORY before building, editing, or auditing any screen, drawer, form, or component in this app (WP_ATOMS) against Figma, and before saying a Figma-sourced pattern has been 'applied' somewhere. Triggers on: building/styling a screen from Figma, auditing a drawer/form/table against a Figma reference, a ticket that cites another ticket as 'same fields/logic as X', or a user saying a previously-fixed pattern still looks old/unchanged somewhere else. Must not be skipped — this project has twice under-scoped a 'apply this pattern' request by only fixing surface-level spacing instead of checking for a full structural match."
disable-model-invocation: false
---

# Figma fidelity checklist (WP_ATOMS)

This skill exists because of a concrete failure mode, not a hypothetical one:
a drawer-field-pairing pattern was learned from Figma and recorded in
`FIGMA_DESIGN_SYSTEM.md` §3.4. When asked to "apply it in Personal
Dashboard," the first pass fixed only a `<Space>` → grid spacing issue on two
drawers and stopped — missing that one of those drawers' own ticket
(`MOVE-3946`) said outright "all fields and logic same as apply leave drawer
in leave module (`MOVE-3777`)," and that drawer still used a structurally
different field shape (a single `RangePicker` instead of paired Start/End
Date fields). The user had to send screenshots and ask "why does this still
look old" before it was actually fixed. This skill is the standing fix for
that gap.

## Steps — follow every time, not just the first time

1. **Read `FIGMA_DESIGN_SYSTEM.md` in full** before touching any screen,
   drawer, or component with a Figma reference. §3.4 is the drawer/form
   field-pattern checklist: row-pairing via grid (not `<Space>`),
   independent-rounded number+unit combos (not `Space.Compact`), `Select`
   once a single-choice field has >2 options, 16px gap for paired date
   fields, button label matching the actual action, and a `message.error`
   toast on invalid submit to match whatever inline error already exists.
   Treat every row as a yes/no check, not a vibe.

2. **If the ticket says "same as X" / "same fields and logic as X" /
   references a sibling ticket, treat it as a literal structural
   requirement, not a thematic suggestion.** Open the sibling's *already-built*
   implementation and diff field-by-field: field names, order, pairing,
   control type, validation rules, disabled/enabled gating, labels, and
   toast copy. A drawer that "has the same fields conceptually" (e.g. a date
   range somewhere) is not the same as one with the literal same field shape
   (e.g. two paired Start/End fields vs. one RangePicker). When in doubt,
   read the other file, don't infer from memory of what it probably looks
   like.

3. **"Applying a pattern" is not done until every row in the relevant
   checklist is either satisfied or explicitly marked not-applicable with a
   reason.** Don't stop at the first divergence found — re-read the whole
   checklist against the target component before reporting completion.

4. **If a user points at a screen/drawer and says it "still looks old"
   after a pattern was supposedly applied there, that is a direct report of
   this exact failure mode.** Don't re-apply the same narrow fix again —
   go back to the ticket text and the sibling implementation and check for
   a deeper structural gap first.

5. **Record what changed in `FIGMA_DESIGN_SYSTEM.md` §3.4 (or a new
   numbered subsection) in the same change**, per the file's own
   "living template" rule — a pattern used twice without being written
   down is a pattern that will drift a third time.

Never skip this because the component "is just a small drawer" or "basically
the same as what was already fixed" — that exact reasoning produced the gap
this skill exists to close.
