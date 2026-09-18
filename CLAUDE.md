# Working agreements for this repository

Standing instructions for Claude sessions on this repo. Structural reference
lives in `DEVELOPER_GUIDE.md`; module business rules live in
`CLAUDE_SESSION_CONTEXT.md`.

## Changelog

`CHANGELOG.md` must stay current. Every change that ships gets an entry **in the
same commit that makes the change** — not batched up afterwards.

- Cite the Jira ticket key when a change comes from a ticket.
- When a change comes from review feedback or a judgment call, say so, and
  record the reasoning. The point is that the *why* survives, not just the *what*.
- Keep the "Open items" table honest: unresolved PM questions, known
  off-spec areas, and tickets that could not be built go there so they are not
  rediscovered from scratch next session.

## Git

- Push to the repository's **default branch**, which is
  `claude/magical-hamilton-RrDQJ`. There is no `main` or `master` branch here,
  and `origin/HEAD` is not set locally, so `git ls-remote --heads origin` is the
  way to confirm the branch list if this name ever changes.
- Also keep the session's working branch in sync so tooling does not report
  unpushed commits.

## Verification

There is no test suite and no lint config, and `tsconfig.json` disables
`noUnusedLocals`/`noUnusedParameters`. So:

1. `npx tsc --noEmit` must be clean.
2. Verify UI changes live in a browser before calling them done — start a dev
   server on a scratch port, drive the interaction with a throwaway Playwright
   script (`chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`),
   read the screenshots, then delete the script and kill the server.
3. Sweep for dead imports by hand after deleting code; the type-checker will not
   catch them.

## Roster module

Three calendar variants exist side by side. As of the 11 Aug 2026 rewrite of
MOVE-3608, **Roster 4.0 (`Roster4Page.tsx`) is the one that matches the PRD** —
a Monday–Sunday month grid with grouped bars. `RosterPage.tsx` and
`Roster3Page.tsx` implement the older matrix reading (employees as rows, dates
as columns) and are kept only as prior explorations.

All roster business rules live in `rosterStatusLogic.tsx` and are shared by every
variant, so a rule fix lands everywhere at once. Keep it that way — presentation
belongs in the pages.

## Jira watch (nightly routine)

A scheduled Routine wakes a fresh session every night at 23:00 SGT, checks
whether any ticket under the Leave epic **MOVE-3410** has been edited since the
last applied change, and applies what it finds. It is **read-only against
Jira** — it never edits, comments on, or transitions a ticket.

- `tools/jira-desc-diff.py` is what makes this tractable. Most Leave ticket
  edits are Jira reflowing its own table markup; the script normalises both
  sides of a description edit to table *cells* so a formatting-only edit prints
  nothing. Feed it the JSON that a `getJiraIssue` call with `expand: changelog`
  writes to disk, plus the date to diff from.
- **The watermark lives in the repo, not in the Routine.** The latest `on:`
  date in `src/components/leave/WhatsNew.tsx` is the last ticket edit that has
  been applied; that is what a run diffs from. So a missed night self-corrects
  on the next run rather than leaving a hole.
- Every change the Routine applies gets a `LEAVE_CHANGES` entry and a `<Mark>`
  pinned to the control it affected, the same as a change made by hand. That
  registry is the module's own record of what moved and when.
