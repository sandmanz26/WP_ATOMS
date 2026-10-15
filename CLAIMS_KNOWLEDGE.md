# Claims — knowledge base (HR web, Personal Dashboard, mobile)

Written 15 Oct 2026 at the user's request: "simpan dulu knowledge yang disini karena nanti akan penting ketika kita bahas untuk claim yang ada di mobile… simpan dalam file, jangan dalam memory." Read this file before any Claims work, **especially the Driver-app (mobile) Claims screens**. Update it in the same change whenever something about Claims is learned.

Related docs:
- `CLAUDE_SESSION_CONTEXT.md` §9 (HR Claims rules) and §10 (Personal Dashboard).
- `FIGMA_DESIGN_SYSTEM.md` §4.6–4.10 (Figma techniques).
- `FIGMA_MOBILE_DESIGN_SYSTEM.md` §5.1 (mobile build).
- `FIGMA_COMPONENT_INDEX.md` (node ids).

---

## 1. Which Claims is which

| Surface | Epic / tickets | Code | Figma |
|---|---|---|---|
| **HR Claims (web, HR module)** | MOVE-4021: 3797 highlights, 3798 listing, 3799 submit, 3801 details, 3920 approve/reject, 3731 cancel, 3957 mark as paid | `src/components/hrclaims/` | **Claim (HR Module)** `Gp7MfEP0XEv8YqZ9q474sj`, page 🏭 Production `23691:148675`, section `29013:27819` |
| **Personal Dashboard Claims (web, self-service)** | MOVE-3412: 3943, 3776, 3964, 3958, 3945 | `src/components/employeeportal/`. Since 15 Oct 2026 it reuses the HR Claims data and drawers | Personal Dashboard - HR Module `1FCRdGhHru6czP5P6h06kH` (Section 7). **Stale**: still shows the old model |
| **Driver app Claims (mobile)** | MOVE-4113 stories: 4431 Manage Claims, 4432 View Claims Application, 4433 Submit Claims, 4434 Cancel Claims. All four were still empty on 13 Oct. Form fields come from the MOVE-4021 epic table. Entry row "Manage Claims" is in MOVE-2280 | none (Figma only) | Mobile Apps Design `IICHGFDHLhKCvE5vMzFokS`, Section 2 `8524:13453`. Section 1 `8521:9653` is the older submission-only version |

All three surfaces now share **one status model** (§2). Until the mobile stories are written, mobile borrows its rules from HR Claims.

## 2. Statuses and lifecycle (HR Claims model)

| Status | Reached by | Tag (web, AntD preset) | Chip (mobile, `Chips/Normal`) |
|---|---|---|---|
| Pending Approval | Submit. Default when the employee has a claims approver | `warning` | `Info` |
| Pending Payment | **Approve** (MOVE-3920). Also the status at creation when the employee has **no** approver | `processing` | `Warning` |
| Paid | **Mark as Paid** from Pending Payment (MOVE-3957): Payment Date + Payment Reference No. | `success` | `Success` |
| Rejected | Reject from Pending Approval. Reason required, max 120 | `error` | `Danger` |
| Cancelled | Cancel from **Pending Approval only**. Reason required, max 120 (MOVE-3731) | `default` (grey) | `Neutral_1`, `States=Default` |

- There is **no "Approved" status** in Claims. That is a Leave status.
- Compared with Leave:
  - Leave has Pending Approval / Approved / Rejected / Cancelled.
  - Leave cancel is allowed while pending **or approved**, with an optional reason.
- The approver relation is `claimApproverOf(employee)`, which currently reuses `leaveApprover`.

## 3. Data shown

- **Claim No.**: `CLYYYYXXXX`, a running number per calendar year, restarting at 0001.
- **Claim types**:
  - HR / Personal Dashboard: Carpark, Taxi, Toll (ERP), Others. "Others" shows as "Others (manual text)".
  - The MOVE-4021 epic table (used on mobile) lists ERP / Carpark / Others.
- **Submit fields (HR, MOVE-3799)**:
  - Employee* and Claim Type*. "Others" adds Specify Claim Type*.
  - Receipt Date* (no future dates) and Receipt Time (optional; if the date is today, later times are disabled).
  - Amount* ("$ 0.00", must be > 0).
  - Vehicle Licence Plate (Carpark / Toll (ERP)) and Trip (Toll (ERP)).
  - Remarks (optional, max 240).
  - Attachments*: Upload button + "Maximum file size: 2MB / Accepted file types: .jpg, .jpeg, .png, .pdf".
  - CTAs: **Cancel / Send for Approval**.
- **Mobile submit fields (MOVE-4021 epic table)**:
  - Date (read-only, today) and Claims Amount* (S$).
  - Claim Type (ERP / Carpark / Others + manual input). The table leaves required/optional blank; it was built as required.
  - Full Name* (searchable, active employees) and Bus Number* (searchable, Westpoint Transit fleet).
  - Route (optional, max 120), Remarks* (max 1000).
  - Attachment(s)* (multiple; png / jpg / jpeg / pdf).
- **Remarks as displayed** = user text + "Vehicle Licence Plate: …" + "Trip: …", on one line joined with " | ". The parts are derived on read, never stored composed.
- **Details drawer (MOVE-3801)**:
  - Header: claim number + status tag.
  - **Basic Information**: Employee (department sub-line), Claim Type, Submission Date, Receipt Date & Time, Amount, Attachments, Vehicle Licence Plate, Trip, and Remarks (full width).
  - **Payment Information** (Paid only): Payment Date, Payment Reference No.
  - **Additional Information**: Created On/By, plus per status Approved On/By, Mark as Paid On/By, Rejected On/By + Reason, Cancelled On/By + Reason.
- **HR listing (MOVE-3798)**:
  - Columns: Claim No., Submission Date, Claim Type, Employee, Department, Amount, Status, Last Updated On. **Remarks was removed on 14 Oct 2026**, but search still covers it.
  - Default sort is last updated, newest first. 10 per page.
- **Personal Dashboard listing (MOVE-3943)** still **includes Remarks**. An approver also gets an Approvals tab with an Employee column.

## 4. What the Claim (HR Module) Figma file contains (read 15 Oct 2026)

Section `29013:27819` has six flow rows, each with a `Docs/Big Title` and `n.m` captions:

1. **Claims Listing**:
   - 1.1 default `43006:22337`
   - 1.2 filter popover `43006:22479`
   - 1.3 highlight active `43006:22621`
   - 1.4 empty search `43023:240323`
2. **Submit Claim**:
   - 2.1 Toll (ERP) filled `43006:24615`
   - 2.2 submitted, back on listing `43023:242551`
   - 2.3 Others `43023:244863`
   - 2.4 Receipt Time with date = today `43069:35877`
   - missing required fields `43006:24781`
3. **Details by status**:
   - 3.1 Pending Approval `43006:22763`, plus a copy `43111:430288`
   - 3.2 Pending Payment `43006:22965`
   - 3.3 Paid `43006:23165` (1130 tall)
   - 3.4 Rejected `43006:23365`
   - 3.5 Cancelled `43006:23565`, plus `43105:19765`
4. **Approve / Reject**:
   - Approve modal `43006:23765` → approved `43023:247822`
   - Reject empty `43006:23967` → filled `43023:250061` → rejected `43023:250676`
5. **Cancel**: empty `43006:24184` → filled `43023:251546` → cancelled `43105:19765`
6. **Mark as Paid**: empty `43006:24401` → errors `43023:256811` → filled `43023:259067` → paid `43023:261293`

**The user's own conventions visible in the file** (follow them on mobile too):
- **Copy placeholders**:
  - Field error captions and the error toast in Submit Claim read `{{refer to copy}}`.
  - Modal bodies and Mark-as-Paid errors read `{{copy to master}}`.
  - Real copy comes from the Lark copy master list, which this session can't open.
- **Review comment tags** (frame `#tags` `39063:10518`):
  - `#CR` requirement change
  - `#Req` missing/incorrect requirement
  - `#Logic` flow/behaviour
  - `#Data` data/calculation/display
  - `#UI/UX` layout/interaction
  - `#Copy` wording
  - `#Std` inconsistent with module standards

  Comments are addressed to a person, e.g. "#CR Daniel".
- **Highlight cards** use `Highlights Card` `43114:431210`: 277×78, a `Title` instance for the number, and a 12px label.
- **Empty state** is the `Empty / Image` component (`43115:433553`) + message. Always use it.
- **Upload** is the `Upload / Button` component + a file row + the 2MB / file-types helper.
- Remarks in the drawer spans both columns.
- Filter popover inputs have no placeholders.
- Before bulk edits, a restore point is saved via `figma.saveVersionHistoryAsync`.

**Fixes applied to the file on 15 Oct 2026** (each with a restore point in version history):
- Remarks column removed from all 26 listing tables.
- Page-1 row 10 corrected to CL20260003 Cancelled (grey).
- All 27 highlight blocks swapped to the 277×78 card.

## 5. Implications for mobile Claims (Driver app)

- **Flow mirrors Manage Leave on mobile**:
  - Account → Quick Actions → **Manage Claims**.
  - List: year dropdown + claim cards (type, S$ amount, claim no. chip, "Submitted on …", status chip) + "Submit New Claim".
  - Submit form.
  - Detail Application per status.
  - Cancel bottom sheet.
- **Use the same 5 statuses and chip mapping** as §2. Mobile has no Mark as Paid / Approve actions; the driver only submits, views and cancels.
- **Cancel** is shown only while Pending Approval, with **Reason for Cancellation required** (from MOVE-3731). Confirm stays disabled until the reason is filled.
- **Detail page rows**:
  - Date, Full Name, Bus Number, Route.
  - Remarks, Attachment(s).
  - Then audit rows: Created On/By, Approved On/By, Mark as Paid On/By + Payment Date / Reference No. (Paid), Rejected/Cancelled On/By + Reason.
- **Sync**: claims submitted from mobile must appear in the HR listing and in Personal Dashboard (same data).
- **Open questions for PM** (mobile stories still empty):
  - Should Full Name default to the logged-in driver?
  - Final CTA copy.
  - Whether mobile shows Pending Payment / Paid at all.
  - Whether the year filter stays.
  - Whether the cancel copy uses `{{copy to master}}`.

## 6. Audit: mobile Section 2 vs HR Claims (15 Oct 2026)

Mobile Apps Design, Section 2 `8524:13453`, compared with §2–§3 above.

| # | Area | Mobile now | HR Claims | Verdict |
|---|---|---|---|---|
| 1 | Status set (list + details) | Pending Approval, Pending Payment, Paid, Rejected, Cancelled | same 5 | ✅ match |
| 2 | Cancel rule | Pending Approval only; Reason for Cancellation required; Confirm disabled until filled | same (MOVE-3731) | ✅ match (mobile lacks the 0/120 counter) |
| 3 | Audit rows per status | Created On/By; Approved On/By; Mark as Paid On/By + Payment Date / Ref No.; Rejected/Cancelled On/By + Reason | same | ✅ match |
| 4 | Submit form fields | MOVE-4021 epic table: Date (read-only), Claims Amount, Claim Type ERP/Carpark/Others, Full Name, Bus Number, Route (120), Remarks* (1000), Attachment(s) | MOVE-3799: Claim Type Carpark/Taxi/Toll (ERP)/Others (+ Specify), Receipt Date*, Receipt Time, Amount*, Vehicle Licence Plate (Carpark/Toll), Trip (Toll), Remarks (optional, 240), Attachments* | ❓ conflict: asked the user |
| 5 | Claim type labels on cards / details | "ERP", "Others (Car wash)" | "Toll (ERP)", "Others (…)", plus Taxi | follows #4 |
| 6 | Detail rows | Date, Full Name, Bus Number, Route, Remarks, Attachment(s) | Submission Date, Receipt Date & Time, Amount, Attachments, Vehicle Licence Plate, Trip, Remarks (" \| " joined) | follows #4 |
| 7 | Status colours | Pending Approval = Info (blue), Pending Payment = Warning (orange) | Pending Approval = warning (yellow), Pending Payment = processing (blue) | ❓ inverted: asked |
| 8 | Amount format | "S$ 2.10" | "$2.10" | ❓ asked |
| 9 | Claim numbers | CL20260011 / 0010 / 0007 / 0004 / 0003 on John Mit's cards | the same numbers belong to other employees in the HR seed | ❌ must be unique once the data syncs; fix after #4 |
| 10 | Year dropdown on list | present (copied from Manage Leave) | no equivalent (HR uses search, filters, Last Updated range) | ❓ asked |

### 6.1 Decisions (user, 15 Oct 2026)

- **Mobile Submit Claim follows HR Claims (MOVE-3799), not the MOVE-4021 epic table.** Fields:
  - Claim Type* (Carpark / Taxi / Toll (ERP) / Others → Specify Claim Type*).
  - Receipt Date* + Receipt Time (optional).
  - Amount*.
  - Vehicle Licence Plate (Carpark, Toll (ERP)) and Trip (Toll (ERP)).
  - Remarks (optional, 240), Attachments*.

  There is no Employee field: the logged-in driver is the employee. Detail rows follow the HR drawer (minus Employee).
- **Status colours = HR**: Pending Approval = Warning (orange), Pending Payment = Info (blue), Paid = Success, Rejected = Danger, Cancelled = Neutral_1.
- **Amount format = `$2.10`**, same as HR (not "S$").
- **Year dropdown on the mobile list stays**, consistent with Manage Leave.
- Mobile claim numbers must not reuse numbers the HR seed already gives other employees.
