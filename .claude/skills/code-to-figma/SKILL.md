---
name: code-to-figma
description: "MANDATORY whenever the user asks to push code, a built screen/module, or HTML into Figma (\"vibe code to Figma\", \"drop menu X ke Figma\", \"buat screen di Figma\", \"html to figma\"), or to review/complete Figma frames that were pushed from code. Encodes the user's standard: every state and flow covered, real library components reused, real data from the code, frames arranged in titled rows with explanatory notes, ticket-driven, verified by screenshot, and documented."
disable-model-invocation: false
---

# Code / screen / HTML → Figma (the user's standard)

The user asked for this to be a skill so they don't have to re-explain it.
A push to Figma is done when **a reader who never saw the code or the
tickets can open the Figma section and understand the whole module**: what
each screen is, which state it shows, how the flows connect, and which
ticket rule drives it. Pretty frames with gaps are not done.

## 0. Before touching Figma

0. **Restore point.** Before editing more than a couple of frames, run `figma.saveVersionHistoryAsync(title, description)` and tell the user the version title/id so they can undo from version history (user, 15 Oct 2026; `FIGMA_DESIGN_SYSTEM.md` §4.10).
0. **Bridge first.** Run `figma_diagnose`. If it isn't connected to the target file, call `figma_pair_plugin` right away, give the user the code, and ask them to open the target file and connect. Don't substitute a code build for a Figma request while waiting (user correction, 13 Oct 2026; see `CLAUDE.md`).
1. **Re-read the tickets, including edits since the last build.** Fetch the
   epic's children (`parent = <EPIC>`). For any ticket updated since the
   last build, fetch it with `expand: changelog` and run
   `python3 -I tools/jira-desc-diff.py <saved json> <last-build-date>`. It
   ignores Jira's own table reflow and prints only real edits. Apply real
   edits to **code first** (with a `CHANGELOG.md` entry), then to Figma. A
   Figma push that misses a ticket edit is wrong even if it looks fine.
2. Read `FIGMA_COMPONENT_INDEX.md` (what was already pushed, node IDs) and
   `FIGMA_DESIGN_SYSTEM.md` §4 (file conventions and every gotcha learned).
3. **Web or mobile?** Mobile app screens (Driver / Passenger) use the Integral DS and `FIGMA_MOBILE_DESIGN_SYSTEM.md`, not the web docs. Mobile means 390-wide frames, Roboto, `#17334f`, a bottom tab bar, and no drawers or tables.
4. Check which module it is. HR Claims (`src/components/hrclaims/`, epic
   MOVE-4021) and Personal Dashboard Claims (`employeeportal/`, epic
   MOVE-3412) are **different modules**. Never mix them.

4. **Figma comments**: a comment tagged `#Req <name>` annotates the requirement for that person; it is not a bug report. Before changing anything because of a comment, read the ticket line it points at. If the wording is ambiguous, ask the user before touching many frames. Example: "2 column layout" means the field *spans* both columns of the drawer's 2-column grid. See `FIGMA_DESIGN_SYSTEM.md` §4.8.

## 1. Tooling

- Use the **Figma Desktop Bridge** (`mcp__Figma_Southleft__*`) for all
  writes and screenshots. It only sees the file currently open in the user's
  Figma Desktop.
  - `figma_diagnose` first. If disconnected, `figma_pair_plugin`, give the
    user the 6-char code, and ask them to open *the target file* first.
  - The official Figma MCP (`mcp__Figma__get_metadata`) is fine for
    **read-only** inspection of any file while the bridge is down.
- **Keep calls small.** One logical change per `figma_execute`.
  - Navigate with `.children.find(name)` paths, not `findAll` over big
    instances. Don't resolve deep `I…;…` IDs.
  - Load fonts once per family/style.
  - Detach and trim heavy instances (hidden sections) before editing them;
    see `FIGMA_DESIGN_SYSTEM.md` §4.6.
- A 30s timeout usually means the change half-applied. Screenshot or
  inspect before retrying; never blindly re-run a clone (you'd get
  duplicates).

## 2. Build from real components

- **Clone the file's own finished screens first** (the `🏭 Production` page:
  listing, profile/drawer, modal flows), then components on `🧩 Component`,
  then the COMPASS design system. Swap variants and properties
  (`setProperties`, `swapComponent`) instead of restyling by hand.
- **HR-module screens are full pages**: 1440×1024 with the `Side Navbar`.
  - A drawer sits on a 40%-black overlay over the page; a modal on a second
    overlay above it.
  - Personal Dashboard screens use content-only frames instead.
- Only hand-build what doesn't exist. Name it
  `… (hand-built, no <X> component found)` so it can be swapped later.
- **Data and copy come from the code**, never lorem ipsum or `{{…}}`
  placeholders:
  - Seed records, status names, labels, toast/modal copy.
  - If a ticket points at an inaccessible copy source (e.g. the Lark copy
    master list), use the code's copy and say so in the notes.
- If a Figma component *can't* express what the code does (e.g. tag colours
  limited to presets), prefer **aligning the code to the component**. Log
  any remaining mismatch in `FIGMA_DESIGN_SYSTEM.md` §7 instead of hiding
  it.

## 3. Coverage checklist (every row is a yes/no, not a vibe)

For each screen and flow in the module, include:

- [ ] Default state with realistic data (enough rows/fields to read as real).
- [ ] Every filter/search UI open at least once (popover, dropdown).
- [ ] Quick filters / highlights in their active state.
- [ ] **Empty state** (no data, or no search result), built from the `Empty / Image` component (key `a03cfe16d7afb97975743504256e318ba445c2d5`) + message. Never hand-drawn (user rule, `FIGMA_DESIGN_SYSTEM.md` §4.10).
- [ ] Each **status** of a record's detail view. Actions menu open where
      actions differ by status. Disabled actions show their tooltip.
- [ ] Each **conditional field** variant (e.g. a type that reveals extra
      fields) at least once.
- [ ] Every form:
  - [ ] Empty with the primary CTA in its real state (disabled if it's
        disabled until input).
  - [ ] Filled.
  - [ ] Validation error (inline field errors **and** the error toast).
- [ ] Every confirm modal: empty (CTA disabled if a reason is required) and
      filled.
- [ ] **Result of every action**: the success toast and the screen the user
      lands on (stays on drawer vs. drawer closes back to the listing). A
      flow without its outcome is not a flow.
- [ ] Anything a ticket edit added since the last push.
- [ ] **Required-field audit, per form frame against the ticket's field table.**
  - Every field is present, including in variant frames.
  - Required asterisk on each required field, including upload.
  - Textarea counter max = the ticket's max length.
  - Upload helper size/types = the ticket's.
  - The error frame shows every required field's error.
  - Use the house patterns in `FIGMA_DESIGN_SYSTEM.md` §4.8: `Upload / Button` + label + helper (not drag-and-drop), modal body `{{copy to master}}`, and **no placeholder in filter-popover inputs**.

## 4. Layout — how the section must read

- **One horizontal row per flow**, steps left → right in the order the user
  experiences them. Rows top → bottom in module order:
  1. Listing.
  2. Create.
  3. Details by status.
  4. One row per action flow (approve/reject, cancel, mark as paid, …).
- **The user's own later rearrangement wins.** If they've edited the section since the last push (moved frames, removed notes, renumbered), keep their version and extend it in the same style; don't restore what they removed. Their 8 Oct edit of the Claim file removed the `Docs/Notes` cards (§4.8).
- **Every row has a header block** above its first frame:
  - A number and flow name, e.g. "3 · Approve / Reject claim".
  - The ticket keys it implements.
  - A one-to-three-line description of the flow's rules.
  - Use the file's `Docs/Flow Label` / `Docs/Notes` / `Docs/Big Title`
    components when present; otherwise plain Inter text, named as such.
- **Every frame has a caption** directly above it:
  - A step number + short state name, e.g. "3.2 Reject — reason required,
    Confirm disabled".
  - One line of what's notable (rule, trigger, outcome).
- **Arrows between consecutive steps** in a flow (a line with an arrowhead,
  e.g. `strokeCap: ARROW_LINES` on the end).
- **A section title block** at the top-left: module name, epic key, ticket
  list, code path, the status legend (tag colour → meaning), and the
  last-updated date.
- Frame names follow `<Module> - <Screen> - <State> (<TICKETS>)`.
- **Reference build**: the Claim (HR Module) file, section `29013:27819`. Its
  grid, caption recipe, arrow recipe and the `Docs/*` component props are in
  `FIGMA_DESIGN_SYSTEM.md` §4.7. Copy that layout unless the user says
  otherwise.
- Text on the canvas must be readable at section zoom:
  - Captions are 44px title + 30px sub-line.
  - Use white/light text when the section background is dark.
- **Every note and caption is checked against the code** (field names,
  conditional fields, toast copy verbatim), not written from memory.
- Spacing:
  - 100px between frames in a row; ~300px between rows (room for headers).
  - Nothing overlaps.
  - Resize the section to fit, with a margin.
- Remove stale duplicates you created. Ask before deleting anything you
  didn't create.

## 5. Verify

- `figma_capture_screenshot` every new or changed frame and read it. Check:
  - Text fits, with no wrapping mid-word.
  - Nothing bleeds into the next column.
  - Hidden overrides didn't leak (e.g. a leftover "X days ago").
  - Toasts sit on top of overlays.
- Compare against the running app (dev server + Playwright) for any screen
  whose code changed in the same task.
- Screenshot the whole section at the end to check the layout reads
  top-to-bottom.

## 6. Document (same change, then commit)

- `FIGMA_COMPONENT_INDEX.md`: one row per screen group with node IDs.
- `FIGMA_DESIGN_SYSTEM.md` §4: every new technique or gotcha. §7: every
  remaining code ↔ Figma deviation.
- `CHANGELOG.md`: what was pushed, why, open items.
- Anything the user taught in this round: write it into this skill or the
  docs above (standing rule in `CLAUDE.md`).
- Commit, then push to the working branch and to the default branch
  `claude/magical-hamilton-RrDQJ`.

## 7. Report to the user (in Bahasa Indonesia, like the conversation)

Say what was added (per flow), what was fixed, which ticket edits were
applied, and any open questions (spec conflicts, deviations). Keep it short.
