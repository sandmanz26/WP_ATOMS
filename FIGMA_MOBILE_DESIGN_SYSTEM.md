# Figma Mobile Design System — Westpoint Driver & Passenger apps

**Read this before building, editing or auditing any MOBILE app screen** (Driver app, Passenger app). The mobile apps use a different design system from the web/HR modules:

| | Web / HR modules (this repo's React app) | Mobile apps (Driver / Passenger) |
|---|---|---|
| Design system | 🧭 COMPASS (AntD-based) + 💎 ATOM Business Component | **🔥🛞 Integral** (`sTpe9MCcI0HQJMmzJnXKRl`) |
| Reference doc | `FIGMA_DESIGN_SYSTEM.md`, `FIGMA_COMPONENT_INDEX.md` | **this file** |
| Font | Inter / SF Pro (AntD) | **Roboto** (all text styles). The iOS status bar uses SF Pro |
| Primary colour | AntD blue `#1677ff` | **Dark Blue `#17334f`** (`Primitive/Primary/600`) |
| Primary button | AntD `Button type=primary` | Integral `Button` `Type=Primary`: solid dark blue, radius 8 |
| Frame size | 1440×1024 desktop page with Side Navbar | **390×844** (some 393×852 / 393×875 "iPhone 16 Pro"), no side nav |
| Navigation | Side Navbar + breadcrumb + page title | Top bar (back arrow + title) and a **bottom tab bar** |
| Tokens | Mostly raw values / AntD theme | **Figma variables** bound on fills, strokes, radius, spacing and font (see §3) |

Never mix them: no COMPASS / AntD components, Inter, or `#1677ff` on a mobile screen, and no Integral components on a web screen. The library search also returns many look-alike libraries (`📒 Mobile WL Lib Component`, `Mobile Atom - Component`, `Aurelia DS`, `TBO`, …). For the mobile apps, use **Integral only** unless the user says otherwise.

Living document: add to it in the same change that finds something new, same rule as `CLAUDE.md`.

---

## 1. Files

| File | Key | What's in it |
|---|---|---|
| 🛞📱 Mobile Apps Design | `IICHGFDHLhKCvE5vMzFokS` | The app screens. Pages: `🚌 Production - Driver` (`1305:8643`), `Component-temp \| not set yet` (`2786:18405`), `Idea` (`0:1`). |
| 🔥🛞 Integral (DS) | `sTpe9MCcI0HQJMmzJnXKRl` | The mobile design system library. Library key `lk-747b38dd4f60…` (full key in §6). Through the official Figma MCP only its `⌘ Cover` page (`4334:2`) is listed. Its components and variables are fully searchable with `search_design_system` + `includeLibraryKeys`. To study its pages directly, open it in Figma Desktop and pair the bridge to it. |

**Driver app — section `Driver` (`2926:9460`, Production - Driver page).** Laid out with the file's own `Docs/Big Title` (pink), `Docs/Flow Label` ("Trip → Navigate") and red "States" labels.
- **Onboarding**:
  - Login Page: `Login/Default` `2396:24089`, `Login/Filled`, `Login/Error`.
  - Forgot Password.
- **Trip**:
  - Home: `v2 With wait time` `2786:16156`, `Active`.
  - Trip Detail for Active Trip.
  - Navigate: in-app map with turn-by-turn header and route points.
  - Trip List, Trip Detail for Upcoming.
  - Feedback: `Detail Trip` `2526:4173` (rating + chips + Submit).
- **Account**:
  - Apply Leave: `Account -> Apply Leave` `2131:7969` and `Account -> Manage Leave`.
  - Log Out, Contact Us.
  - Account Information: `Account` `1929:6500`.
  - Password, Trip History.
- **Notification**: Notification Page `3653:22772`, Daily Schedule Notifications, Notification Details.
- **Push Notification**: `iOS 15 Push Notifications` → clicked.

Other Driver pieces on the page:
- Section `CR - New` (`8428:17692`), change requests.
- Section `Leave` (`8515:13884`).
- Loose `Trip Card` frames.
- `Trip Details` component set (`5149:9376`).

**Passenger app** frames currently sit on `Component-temp` as `Passenger + …` (390×844):
- Home `8436:13606` (+ Card Clicked, Expanded Point), Login, Register.
- Detail Trip, Trip, Account (+ enabled), Notifications, Push Notification.

That page also holds `Driver + …` copies, the local components (§4.2), and some 1440 web frames (Live Tracking, Leave, Employee, Roster) used as references.

---

## 2. Screen anatomy (how a mobile screen is put together)

Most screen chrome is **hand-built frames, not components**. Reuse it by cloning from a Production screen, not by drawing.

| Part | How it's built | Example to clone |
|---|---|---|
| iOS status bar | Frame `Top Bar Iphone` (390×44–48) using library pieces (`SIM`, `Network`, `Battery`, `Privacy Indicator`, `Location Services`); time in SF Pro | any screen, top child |
| Top bar / page header | Frame (~390×40): back arrow icon + title, **Roboto SemiBold 16** (e.g. "Leave Application"). White, no breadcrumb | `2131:7969` → `Frame 43185` |
| Bottom tab bar | Frame `Frame 1410126614`, 390×88, **radial gradient `#3b5269` → `#7a8a99`**, top radius. Four tabs (icon + label): **Dashboard / Trips / Notification / Account**. Active = Roboto **Bold** 14, white; inactive Regular 14 | `3653:22772` |
| Home indicator | `NavigationBar` frame at the bottom | `3653:22772` |
| Hero / highlight cards | Dark-blue → grey gradient cards (e.g. "Your Next Active Trip", Passenger Home trip card), white text, radius 12–24 | `2526:4173`, `8436:13606` |
| Map | Map image + route polyline + numbered point markers (dark-blue circles) + blue location arrow; floating round buttons (mute, recentre, SOS in red) | `2786:16156` |
| Forms | Integral `Input/Input Border Style` per field (label above, `*` for required), Integral `Upload File` for documents, Cancel = `Button` `Outline Brand`, submit = `Button` `Primary` | `2131:7969` |
| Lists (account / info rows) | Row = icon + label (Roboto Regular 14, grey) + value right (Roboto SemiBold 14), 1px divider `Border-3` | `1929:6500` |
| Notification list | Row: app icon tile + title (Medium 14) + 1-line body + date / time; unread = tinted row + red dot | `3653:22772` |
| Docs on canvas | `Docs/Big Title`, `Docs/Flow Label` ("Parent → Current"), `Docs/Notes`, red "States" label | section `2926:9460` |

Screen padding is **16px** left/right. Content cards are 358 wide (390 − 2×16).

---

## 3. Tokens (Integral variables — bind these, don't hard-code)

### 3.1 Colour (collection `Colors`; Primitive → Base hex)

| Token | Resolves to | Used for |
|---|---|---|
| `Primitive/Primary/600` (`Semantic/Button/Button-Primary`, `General-Brand`, `Text/Body-Brand`, `Border-Brand`) | Base/Dark Blue/600 **`#17334f`** | primary buttons, brand text, active borders |
| `Primitive/Primary/500` (`Text/Heading-Brand`, `Icon/Heading-Brand`) | Dark Blue/500 | brand headings / icons |
| `Primitive/Primary/300` (`Button/Button-Border`) | Dark Blue/300 | outline button border |
| `Semantic/Text/Heading-1`, `Icon/Heading-1` | Neutral/950 `#181a1b` | headings |
| `Semantic/Text/Body-1`, `Icon/Body-1` | Neutral/800 `#323638` | body text / icons |
| `Semantic/Text/Body-2` / `Body-3` | Neutral/700 `#464c4f` / Neutral/600 `#565d61` | secondary text |
| `Semantic/Text/Placeholder-1` / `-2` | Neutral/400 `#a7aaac` / Neutral/350 `#bcbebf` | placeholders, disabled |
| `Semantic/Text/Body-8` / `Body-9` | Neutral/50 `#fcfcfc` / Neutral/100 `#f9f9f9` | text on dark surfaces |
| `Semantic/Border/Border-2` / `Border-3` / `Border-4` | Neutral/150 `#f4f4f4` / Neutral/250 `#e0e1e1` / Neutral/400 `#a7aaac` | dividers, input borders |
| `Semantic/General/Fill-Solid-White` / `-Black` | `#ffffff` / `#000000` | surfaces |
| `Primitive/Danger/600` (`Text/Body-Danger`, `Icon/Body-Danger`) | Red/600 `#e43231` | required `*`, errors, SOS |
| `Primitive/Danger/500` | Red/500 `#e43231` | danger fills |
| `Primitive/Success/600` | Green/600 `#30b080` | success |
| `Primitive/Info/600` | Blue/600 `#0078f0` | info |

There are also Warning / Secondary / Accent ramps (`Primitive/*/100–1000`) and semantic `Border-Success/Warning/Info/Danger-Soft/Danger-Bold/Disable`.

### 3.2 Typography (Roboto; text styles + variables `Family/*`, `Size/*`, `Height/*`, `Weight/*`)

| Style | Font / size / line height | Typical use |
|---|---|---|
| `displaySmall/Semi Bold` | Roboto SemiBold 40 / 48 (`Size/H3`) | big numbers |
| `titleLarge/Semi Bold` | SemiBold 24 / 32 (`Size/B1`) | screen hero titles ("Let's Get You Started", "We'd love to hear…") |
| `titleMedium/Bold`, `/Medium` | 18 / 28 (`Size/B2`) | section / card titles |
| `titleSmall/Bold`, `/Semi Bold`, `/Reguler` | 16 / 24 (`Size/B3`) | top-bar titles, button labels |
| `bodyLarge/Regular`, `/Medium`, `/Semi Bold`, `/Bold` | 14 / 20 (`Size/B4`) | body, list rows (**most used**) |
| `labelLarge/*` | 14 / 22 (`Size/L1`) | form labels |
| `labelMedium/*` | 12 / 18 (`Size/L2`) | captions, dates, chips |
| `labelSmall/*` | smaller labels | tags |

Weights are variables: `Weight/Regular` (value "Reguler"), `Medium`, `Semibold`, `Bold`.

### 3.3 Spacing, radius, shadow

- **Spacing variables** `Spacing/spacing-{2,4,6,8,10,12,16,20,24,28,32,36,40,44,48,64,72,76}`. Most used: 8, 12, 10, 4, 16.
- **Radius** `Corner Radius/radius-{8,10,12}`, `Button` → `rad-8`, `radius-full`. Inputs and buttons use 8; cards 12–16; sheets and hero cards 24; pills 200/999.
- **Shadows** (effect styles) `shadow-xtra-small / small / medium / large / xtra-large / super-large`.

---

## 4. Component mapping

### 4.1 Integral library components (use these first)

| Need | Integral component | Key props (variant options) | Seen in |
|---|---|---|---|
| Button | **`Button`** (key `e23481ef886cdb5784d2b9c331b6033ad06e1f29`) | `Type` Primary / Outline Brand / Outline Neutral / Accent / Info / Success / Warning / Danger / Link Brand / Link Neutral · `Size` XtraSmall / Small / Medium / Large · `State` Active / Focus / Hover / Press / Disable · `Icon only` On / Off · `Input text#2053:13` · show icon left / right / brand icon | Apply Leave (Cancel = Outline Brand, Apply = Primary), Login, Feedback |
| Loading button | `Button Loading` | — | — |
| Text input / select / date / password / phone | **`Input/Input Border Style`** (key `a8cb449ec465144fc3fb88a553f505b163cc6297`). Also `Input/Input Borderless Style`, `Input/Input Set` | `Variant` Icon / Password / Country Code / Image / Prefix Suffix / Chip · `Size` Small / Medium / Large · `State` Default / Active / Filled / Error / Disable / Typing · `Show label`, `Show hint text`, `Show icon left/right`, `Show prefix/suffix` · label text props (`Label#8293:122` …), `Hint#8293:244` | Login (Country Code, Password), Apply Leave (select, date with calendar icon) |
| Dropdown menu | `Input dropdown menu`, `Input dropdown menu item` | — | — |
| Number / OTP / time / verification | `Form/Number Input`, `Atom OTP-Input`, `Time Picker`, `Verification Fields` | — | — |
| File upload | **`Upload File`** (key `86e1c0b18c62e0e552c4ba4c0e6751f6464d6a34`) | `State` Default / Uploading / Success / Failed / Change · `Show label` | Apply Leave "Supporting Documents" |
| Chip / tag / pill | **`Chips/Normal`** (key `e5bd12e21ff41a0bd19c67a09e3142aed6062c6e`) | `Variant` Neutral_1 / Neutral_2 / Primary / Secondary / Info / Success / Warning / Danger · `Size` Small / Medium / Large / Xtra Large · `States` Default / Hovered / Disabled / Active / Default Transparent · `Text#10472:0` · icon left / right · Image, Social media | Feedback experience chips, route chips, "Dyson" customer pill |
| Icon | **`Icon Wrapper`** (key `7d19651f…`; `Icon` instance-swap, `Size` super-small … super-large) and `◈ IconWrapper 2.0` (`Size` Tiny … Huge). Glyphs are **Tabler icons** (`user`, `hexagon`, `steering-wheel`, `bell`, `clock`, `map-pin-star`, `sos`, `navigation` …) | — | everywhere |
| Modal / dialog | `Modal Basic`, `Modal Pre Build`, `ModalHeader`, `ModalHeaderContent`, `IconModal` | — | — |
| Toast | `ToastContainer` | — | — |
| Avatar | `Avatar`, `Avatar Group`, `Online Indicator`, `Verification Badge` | — | — |
| Checkbox / radio / toggle | `Checkbox Atom` / `Checkbox Pre Build`, `RadioButton Atom` / `RadioButton Pre Build`, `◈ Toggle / Base` / `◈ Toggle / Prebuild` | — | — |
| Tabs | `Tab base`, `Tab Group` | — | — |
| Navigation | `◈ Navigation / Nav Item`, `Nav Item`, `Nav Child Item`, `Top Navigation & Float Navigation`, `Bottom Menu`, `Right Menu`, `Side Navigation Bar` | — | (the production tab bar is hand-built; see §2) |
| Floating action | `FloatingButton Pre Build`, `FloatingButtonChild Atom` | — | — |
| Progress | `Progress bar`, `Progress circle`, `Circular progress indicator` | — | — |
| Empty state | `Empty State` | — | — |
| Cards / metrics | `Metrics Card`, `Label Ticket`, `Ticket Group`, `Urgency` | — | — |
| Pagination / table | `Pagination`, `Table`, `Table Cell`, `Table Header Cell` | — | — |
| Rich text editor | `Rich Component / Base`, `Toolbar / Arrows / Paragraph / Formatting` | — | Feedback "Other Feedback" (hidden toolbar) |
| Misc | `Scroll bar`, `Safety Bar Indication`, `Color Picker` | — | — |

### 4.2 Local components in the Mobile Apps file (`Component-temp` page)

| Component | Id | Notes |
|---|---|---|
| `Leave Card` | `8197:21416` | 358×290 leave application card |
| `Status` (set) | `8197:21408` | `Property 1` Rejected / Cancelled / Pending / Approved: the leave status badge |
| `Trip Details` (set) | `5149:9376` | `Driver` text prop: trip detail block |
| `Driver - Sidebar Menu` / `Pass - Sidebar Menu` | `8188:15259` / `8188:6586` | side menus (390 wide) |
| `Component 21` (set) | `2786:16994` | home trip card variants |

### 4.3 Web (AntD / COMPASS) → mobile (Integral) equivalents

Use this table when a feature exists on web and needs a mobile screen, e.g. Leave, Claims or web tracking.

| Web (AntD / COMPASS) | Mobile (Integral) |
|---|---|
| `Button type=primary` / default / `danger` | `Button` `Type=Primary` / `Outline Brand` (or `Outline Neutral`) / `Danger` |
| `_Form / Form Item / Vertical` (Select, DatePicker, Input, Textarea) | `Input/Input Border Style` (`Variant=Icon` for select/date, label on, `*` in the label text), one per row, full width |
| `Upload / Button` + file row + helper | `Upload File` (`State` Default → Uploading → Success / Failed) |
| `Tag / Status` | `Chips/Normal` (`Variant` Success / Warning / Danger / Info / Neutral) or the local `Status` set for leave |
| `Drawer` (details) | full-screen pushed page with top bar + back arrow (no drawers on mobile) |
| `Modal` confirm | `Modal Basic` / `Modal Pre Build` (body copy `{{copy to master}}` per the house rule in `FIGMA_DESIGN_SYSTEM.md` §4.8) |
| `Toaster Pop-up Message` | `ToastContainer` |
| Table listing | stacked cards / list rows (no tables on mobile) |
| Filter popover | chips row or bottom sheet (check Integral, ask if unclear) |
| Side Navbar | bottom tab bar (Dashboard / Trips / Notification / Account) |

---

## 5. How to work in these files

- **The bridge first** (`CLAUDE.md`): the Desktop Bridge only sees the file open in Figma Desktop. The Mobile Apps file and the Integral file are separate files, so pair to whichever one is being worked on.
- **Clone a Production screen** (status bar, top bar, bottom tab bar, cards). Then use Integral instances for buttons, inputs, chips, upload and icons. Keep their variable bindings: change variants and properties, not raw colours.
- Data on screens is realistic Westpoint data (e.g. Dyson Jurong, "(Bus stop) Infront Blk 651A - Pioneer MRT…", PCX00124K, Rahibu Ali), not lorem ipsum.
- `getMainComponentAsync()` is required in this file. The sync `mainComponent` throws with dynamic-page access.
- Some Production frames are 393 wide (iPhone 16 Pro) and some are 390. Match the frame you're extending.

---

## 5.1 Built so far

| Feature | Where | Frames | Notes |
|---|---|---|---|
| **Claims — Manage Claims** (Driver app; epic MOVE-4113 stories MOVE-4431/4432/4433/4434, form per MOVE-4021) | Production - Driver → `Section 2` (`8524:13453`) | `8524:13458` Account (Quick Actions → **Manage Claims**), `8524:13615` Manage Claims list, `8524:13570` Submit Claim form, details `8524:14017` Pending Approval / `8524:14069` Pending Payment / `8524:14125` Paid / `8524:14181` Rejected / `8524:14240` Cancelled, `8524:15021` Cancel Claim sheet | **Current version (user, 14 Oct 2026), modelled on Manage Leave; fields / statuses aligned to HR Claims on 15 Oct 2026 (see `CLAIMS_KNOWLEDGE.md` §6). Extra frame: Submit filled `8545:15279`.** List = year dropdown + claim cards (type, amount, claim no. chip, "Submitted on …", status chip) + "Submit New Claim". Details = Leave's detail page + claim rows (Date, Full Name, Bus Number, Route), Remarks, Attachment(s), audit rows per status. Cancel only while Pending Approval, reason required (web MOVE-3731). Docs: `Docs/Big Title` `8524:13454`, notes `8524:15113` / `8524:15120`, flow labels per row, captions 2.x / 3.1, orange arrows. |
| **Claims — submission only** (superseded) | Production - Driver → `Section 1` (`8521:9653`) | `8522:12503` Account (Quick Actions → Submit Claim), `8522:12658` Submit Claim | Earlier version, from when the user said mobile is submission only. Superseded by Section 2 after the MOVE-4113 claims stories appeared; kept untouched. |

Techniques and gotchas from the Claims build:
- **Before building a mobile version of a web feature, confirm what the app actually needs: check the mobile epic's children** (`parent = MOVE-4113` for the Driver Accounts tab). Claims went "submission only" → "Manage Claims like Manage Leave" once MOVE-4431–4434 appeared. The MOVE-4021 epic description's own field table is still the form spec, and it differs from the web child tickets.
- **The Leave flow is the template for any "my requests" feature.**
  - List = year `Input` + `Leave Card` frames (title, big value, small `Chips/Normal` Neutral_1, "Submitted on …", status chip) + full-width `Button` Primary.
  - Form = stacked `Input/Input Border Style`; two-up rows for related pairs; `Upload File`; Cancel (Outline Brand) + submit (Primary).
  - Details = header (type, big id + small chip, status chip), key/value rows (`Frame 1410126870` pattern: 12px label left, value right), a grey "Remark" box, file chips, line, Created On / By, and an Outline Brand action button.
- **Status chip variants** (`Chips/Normal`, Size Medium, States Active): Pending Approval → `Warning` (salmon/orange), Pending Payment → `Info` (blue) — same as HR since 15 Oct 2026, Paid → `Success`, Rejected → `Danger`, Cancelled → `Neutral_1`. The chip has a fixed 83px width, so `resize(124, h)` for "Pending Approval" / "Pending Payment". **Cancelled** = `Neutral_1` with `States=Default` (Medium has no `Neutral_1` + `Active` combo, so `setProperties` throws "Unable to find a variant").
- **Setting `Label#8293:122` on `Input/Input Border Style` resets the label's red `*`.** Re-apply it with `setRangeFills(i, i+1, Danger #e43231)` on the `Email` text node (that's the label layer's name).
- Field icons are the inner `icon left` / `icon right` instances (`Icon#10392:0` swap). Use a component id already in the file, e.g. `clock` `829:6105` for time and `note` `203:2096`.
- **`importComponentByKeyAsync` for Integral icons timed out (30s) through the cloud bridge.** Use an icon already present in the file (find its main component with `getMainComponentAsync()` on any instance) instead of importing from the library.
- The Account page's Quick Actions block is a `Driver - Sidebar Menu` instance. **Detach it** to add a row: clone the `Container` row, set the text, swap the `◈ IconWrapper 2.0` `Icon#89:0`.
- **Rebuilding a Leave detail page for another record type:** clone the leave detail and empty `Frame 1410126874` (the body). Then refill it with clones of the Rejected leave detail's (`8484:6814`) parts:
  - its rows container (`Frame 1410126872`) for the field rows and the audit rows;
  - one label/value row (`Frame 1410126870`);
  - the grey reason box (`Frame 1410126868`);
  - the remark + attachment group;
  - `Line 38`.

  Remove the bottom `Button` where the status has no action. Then set the body's parent `Frame 43196` to `primaryAxisAlignItems='MIN'`. Clones of Approved/Pending leave use `SPACE_BETWEEN`, which floats the content down once the button is gone.
- Keep the person consistent: the Account page's logged-in driver is **John Mit**, so Created By / Full Name on that driver's records use the same name.
- `Docs/Big Title`'s `Brief` description is ~180px type. Don't put notes there. Use a `Docs/Notes` clone (`2367:23027`) instead.
- Instance property edits on these library components are slow. Do **one card or one screen per `figma_execute`**, or the call times out after half-applying.
- Docs on canvas: `Docs/Big Title` (`2926:9461`), `Docs/Flow Label` (`1929:6773`, `Size=Small`, still ~670–1170px wide, so use a **1300px column pitch** for 390 frames), `Docs/Notes` (`2367:23027`). Arrows are orange, 6px; a branch (list → submit) uses an elbow arrow under the frames.

---

## 6. Reference: library keys

- Integral: `lk-747b38dd4f601acdfce08aa11be65bc0d49a124418e5059f7b9cce40b3e2e1570654b2d82ba68c6262d7ae6a11f941969d3b530a9fafc345cf73951a3c08c7e7`
- (Web) COMPASS: `lk-d71fb0e8f1777bdaf7149c5afd3f39e4a2ce0cb802bb67b25a0436bd5768213bb0f683a5943600bc0b4ac2c4d73cee3d4fca1a9794be73e4d08c183c64510d1c`, so you can tell which is which in search results.
