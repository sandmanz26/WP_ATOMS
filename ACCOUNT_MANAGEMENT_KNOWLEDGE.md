# ATOMS Account Management: knowledge base

Written 15 Oct 2026 from Jira epic **MOVE-4449 "ATOMS Account Management"**. The epic description reads "Replace current 'staff' module on ATOMS".

- Figma working area: **Account Management - HR Module** `kI1rSu1FAsPpV5K1EI2HvM`, node `41001:22331`.
- Read this file before any Account Management work, and update it in the same change whenever something new is learned (CLAUDE.md rule).

## 1. Tickets (children of MOVE-4449, as of 15 Oct 2026, all "To Define Tasks")

| Key | Summary | Scope |
|---|---|---|
| MOVE-4452 | ATOMS Account Listing | **Build**: listing, sort, search, filters |
| MOVE-4450 | (Manual) Create ATOMS Account | **Build**: create drawer |
| MOVE-4455 | ATOMS Account Details Drawer | **Build**: details + actions |
| MOVE-4456 | Edit ATOMS Account | **Build**: edit drawer |
| MOVE-4453 | Suspend ATOMS Account | **Build**: suspend modal (manual suspend marked "potentially MVP 2") + auto-suspend |
| MOVE-4457 | Unsuspend ATOMS Account | **Build**: unsuspend modal (manual "potentially MVP 2") + auto-unsuspend |
| MOVE-4451 | Auto-create ATOMS Account | System rule: no screen, but explains "Created By = system" |
| MOVE-4463 | Verify Account & Set Password (Email) | Email with a verify + set-password link; no admin screen |
| MOVE-4458 | ATOMS Account Activity | Only "Similar to current staff activity log" |
| MOVE-4465 | [KIV 2] Account Change History | Empty |
| MOVE-4466 | [KIV 1] Verify & Set Password (SMS) | KIV |
| MOVE-4454 | [KIV 3] Auto-deactivate | KIV: employee/driver becomes inactive → account deactivated |
| MOVE-4459 | [KIV 4] Auto-reactivate | KIV |
| MOVE-4460 | [KIV 5] Reset Password | KIV: same as the current staff module (reset link via email/SMS) |

## 2. Account statuses

- **Active**: on creation, manual or auto.
- **Suspended**: manual suspend (MOVE-4453), or auto when the employee / sub-con driver becomes suspended. A suspended account is logged out and cannot log in.
- **Deactivated**: only via KIV MOVE-4454. Edit / Reset Password are disabled for deactivated accounts (MOVE-4455).
- The details drawer header = full name + **status tag**. The listing has **no status column** in MOVE-4452 (open question).

## 3. Listing (MOVE-4452)

- Module home → tab **"Accounts"**. The module has tabs; another one is probably Activity (MOVE-4458).
- **Columns**:
  - Full Name ("given name + family name").
  - Account Type (Employee / Sub-contractor Driver).
  - Access Roles (comma-separated, wraps to multiple rows; '-' for sub-con drivers).
  - Last Login (date & time).
  - Last Updated (date & time).
- **Sort**: default last updated, newest first. Alphabetical by Full Name and Account Type; chronological by Last Updated.
- **Search** "Search Accounts": Full Name, Access Roles.
- **Filters**: Access Roles (multi-select + search, options = roles from Roles & Permissions), Account Type (single-select), Last Login (date range).
- Toolbar date range: **Last Updated On**.
- **Primary CTA**: "Create Account" → create drawer. A row click opens the details drawer.

## 4. Create drawer (MOVE-4450)

Header "Create ATOMS Account"; CTAs **Cancel / Create**.

| Field | Type | Req | Rules |
|---|---|---|---|
| Account Type | Dropdown | Required | Employee / Sub-contractor Driver |
| Given Name | Text | Required | max 50 |
| Family Name | Text | Required | max 50 |
| Username | Text | Required | Auto-filled "given name+family name", editable, max 50. A duplicate puts the field in an error state and shows an error toast |
| Mobile Number | Country code dropdown + number | Required | Default +65 (Singapore) |
| Work Email | Text | Optional | Shown only for Employee |
| Access Roles | Multi-select dropdown with search | Required (if shown) | Shown only for Employee; options = role titles |

- **Create**: the drawer closes, the user stays on the listing, a success toast shows, and status = Active.
- **Missing required fields**: error toast + fields in error state.
- **Cancel**: nothing is saved.

## 5. Details drawer (MOVE-4455)

- **Header**: full name + status tag.
- **Basic**: Username, Access Roles ('-' for sub-con driver), Mobile Number, Work Email ('-' if none).
- **Additional**:
  - Created On / Created By ("system" if auto-created).
  - Last Updated On / By.
  - When suspended: Suspended On, Suspended By, Reason for Suspension.

**Actions**

| Action | Where | Enabled when |
|---|---|---|
| Edit | primary CTA | status ≠ deactivated |
| Reset Password | Actions dropdown | status ≠ deactivated (feature itself KIV 5) |
| Suspend | Actions dropdown | status = active |
| Unsuspend | Actions dropdown | status = suspended |
| View Change History | Actions dropdown | always (feature KIV 2) |

Disabled items show a tooltip (copy master list).

## 6. Edit (MOVE-4456)

- Same fields as Create, but **Account Type is disabled**. Header "Edit [full name]"; CTAs **Cancel / Save**.
- **Save**: the drawer closes, the user returns to the listing (per the ticket), a success toast shows, and the status is unchanged.
- **Data sync**:
  - Account edits don't change the employee / sub-con driver records, except Access Roles, which flow to the employee profile.
  - Given/Family Name, Mobile Number and Work Email edited in Employees / Sub-con modules flow into the account.

## 7. Suspend / Unsuspend (MOVE-4453 / MOVE-4457)

- **Suspend modal**: Reason for Suspension, required, max 120. Confirm → status Suspended, toast, details drawer shows Suspended On/By/Reason. An empty reason gives an error toast + field error, and the modal stays open.
- **Unsuspend modal**: a confirm only. Confirm → Active, and the suspension rows disappear.
- **Auto rules**: suspend/unsuspend follows the employee / sub-con driver status. Auto-suspend copies the reason and actor from that module.
- **Where the user lands**: the ticket says "remain on accounts listing page" after both confirms. Unlike Claims/Leave, where the user stays on the drawer. Open question.

## 8. Account types and auto-create (MOVE-4451)

- **Employee**: created when the employee goes future → active (first contract start). Name / mobile / work email / access roles come from the employee profile (MOVE-3416).
- **Sub-contractor Driver**: created when the sub-con driver is created. Name / mobile come from the sub-con module. No email, no access roles.
- **Verification email** (MOVE-4463): sent on creation if there's a work email. The link lets the user verify the account + set a password.

## 9. Open questions for PM

1. The listing has no Status column; should Active / Suspended show in the listing?
2. After Suspend / Unsuspend / Edit save, does the user really leave the drawer for the listing? Claims and Leave stay on the drawer.
3. The Activity tab (MOVE-4458) has no spec beyond "similar to current staff activity log".
4. Username duplicate check: the ticket ends with "?", so it's unconfirmed.
5. Should Access Roles be read-only in the Employees module once accounts own them? (raised in MOVE-4451)
