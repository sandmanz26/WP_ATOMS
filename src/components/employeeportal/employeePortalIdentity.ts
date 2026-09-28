// Personal Dashboard (epic MOVE-3412) — which employee "I" am signed in as.
//
// Centralized so every Personal Dashboard tab (Leave, Claims, ...) agrees on
// "self" — there is no login in this prototype. Citra Dewi (lv-3) is also the
// `leaveApprover` for five other seed employees (Hendra, Joko, Lukman, Cahya,
// Krisna), which is what gives "Pending My Approval" real rows on first
// render in both Leave and Claims (see `claims/claimsLogic.ts`'s
// `claimApproverOf`, which reuses the same relationship).
export const PORTAL_SELF_ID = 'lv-3'
