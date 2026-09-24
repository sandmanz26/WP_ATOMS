// Driver mobile app — Manage Leave, under epic MOVE-4113 (Accounts Tab).
//
//   MOVE-2481  [D] Manage Leave           — the hub: application cards + balance cards
//   MOVE-4074  [D] Apply Leave            — the form
//   MOVE-4073  [D] View Leave Application — the detail screen
//   MOVE-4075  [D] Cancel Leave           — the confirm modal and what it does
//
// This is a *phone* prototype living inside a desktop shell, so it renders in a
// fixed 390x844 frame rather than filling the page. Parked under the Customer
// Notification menu on purpose: the name does not match, and that is the point
// — it stays out of the way until it is ready to be shown.
//
// Every rule it obeys is already written down in `leaveLogic`, because the
// driver tickets defer to the HR ones (MOVE-2481 §2 cites MOVE-3494 biz req 2,
// and the expand section cites MOVE-4137 biz req 1.2). Nothing about leave is
// re-derived here; this file is presentation and flow only.

import { useMemo, useState } from 'react'
import { Button, DatePicker, Input, Select, TimePicker, Upload } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import {
  ArrowLeftOutlined,
  DownOutlined,
  PaperClipOutlined,
  PlusOutlined,
  UpOutlined,
  UploadOutlined,
  WifiOutlined,
} from '@ant-design/icons'
import {
  CURRENT_USER,
  DOC_REQUIRED_TYPE_IDS,
  LEAVE_APPLICATIONS,
  LEAVE_EMPLOYEES,
  nextId,
  type HalfDay,
  type LeaveApplication,
  type LeaveStatus,
} from '../leave/leaveData'
import {
  ISO,
  balancesFor,
  deductionFor,
  entitlementBreakdown,
  formatDays,
  formatValidity,
  isSelectableDate,
  leaveTypeById,
  type BalanceRow,
} from '../leave/leaveLogic'

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

const PHONE_W = 390
const PHONE_H = 844

/** MOVE-2481 §2.2 row 5 — the four statuses, and how the app colours them. */
const STATUS_STYLE: Record<LeaveStatus, { fg: string; bg: string }> = {
  'Pending Approval': { fg: '#d46b08', bg: '#fff7e6' },
  Approved: { fg: '#389e0d', bg: '#f6ffed' },
  Rejected: { fg: '#cf1322', bg: '#fff1f0' },
  Cancelled: { fg: '#8c8c8c', bg: '#f5f5f5' },
}

function StatusPill({ status }: { status: LeaveStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.fg}33`,
        borderRadius: 999,
        padding: '2px 9px',
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}

function Card({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #ebedf0',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {children}
    </div>
  )
}

/** Label above, value below — the shape every mobile detail row uses here. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fff',
        flexShrink: 0,
      }}
    >
      {onBack && (
        <ArrowLeftOutlined onClick={onBack} style={{ fontSize: 16, cursor: 'pointer', color: '#1a1a1a' }} />
      )}
      <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
    </div>
  )
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 10px' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{children}</span>
      {right}
    </div>
  )
}

// ---------------------------------------------------------------------------

type Screen = 'manage' | 'apply' | 'view'

export default function DriverLeaveApp() {
  // MOVE-2481 §1 — the page belongs to an own-tenant driver. Joko Prasetyo is
  // the one seeded with all four application statuses, which is what makes
  // MOVE-4075's enabled/disabled button states visible at all.
  const driver = LEAVE_EMPLOYEES.find((e) => e.id === 'lv-10')!

  const [screen, setScreen] = useState<Screen>('manage')
  const [viewId, setViewId] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [offline, setOffline] = useState(false)
  const [popup, setPopup] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const thisYear = dayjs().year()
  const [year, setYear] = useState(thisYear)

  const bump = () => setRevision((r) => r + 1)

  const flash = (msg: string) => {
    setPopup(msg)
    window.setTimeout(() => setPopup((p) => (p === msg ? null : p)), 2600)
  }

  /** Biz req "Offline Status Banner" §3 — navigation is what gets blocked. */
  const go = (next: Screen, id?: string) => {
    if (offline) {
      flash('Unable to access due to no internet connection')
      return
    }
    if (id !== undefined) setViewId(id)
    setScreen(next)
  }

  const toggleOffline = (next: boolean) => {
    setOffline(next)
    // §2.4 — reconnecting is announced; going offline is shown by the banner.
    if (!next) flash('You are back online')
  }

  const applications = useMemo(() => {
    void revision
    return LEAVE_APPLICATIONS
      .filter((a) => a.employeeId === driver.id)
      .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn))
  }, [driver.id, revision])

  const balances = useMemo(() => {
    void revision
    return balancesFor(driver, year)
  }, [driver, year, revision])

  const openApp = applications.find((a) => a.id === viewId) ?? null

  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* ---------------- the phone ---------------- */}
      <div
        style={{
          width: PHONE_W,
          height: PHONE_H,
          background: '#f5f6f8',
          borderRadius: 34,
          border: '9px solid #1a1a1a',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* §2.1/2.2 — a fixed banner, not a toast, and it simply goes away on
            reconnect rather than being dismissed. */}
        {offline && (
          <div
            style={{
              background: '#fff1f0',
              borderBottom: '1px solid #ffa39e',
              color: '#cf1322',
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <WifiOutlined /> You are currently offline
          </div>
        )}

        {screen === 'manage' && (
          <ManageLeave
            driver={driver}
            applications={applications}
            balances={balances}
            year={year}
            thisYear={thisYear}
            onYear={setYear}
            onApply={() => go('apply')}
            onOpen={(id) => go('view', id)}
          />
        )}

        {screen === 'apply' && (
          <ApplyLeave
            driver={driver}
            balances={balancesFor(driver, thisYear)}
            onBack={() => setScreen('manage')}
            onSubmitted={(msg) => {
              bump()
              setScreen('manage')
              flash(msg)
            }}
          />
        )}

        {screen === 'view' && openApp && (
          <ViewLeaveApplication
            app={openApp}
            onBack={() => setScreen('manage')}
            onCancel={() => setCancelOpen(true)}
          />
        )}

        {/* MOVE-4075 §2 — confirmation modal, copy quoted from the ticket. */}
        {cancelOpen && openApp && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              zIndex: 20,
            }}
            onClick={() => setCancelOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 14, padding: 20, width: '100%' }}
            >
              <div style={{ fontSize: 14, lineHeight: 1.55, color: '#1a1a1a', marginBottom: 18 }}>
                Are you sure want to cancel this Leave? You will not be able to revert this action.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button block onClick={() => setCancelOpen(false)}>Cancel</Button>
                <Button
                  block
                  type="primary"
                  onClick={() => {
                    // §2 — status, stamps, and the balance follows from them:
                    // `usageFor` only counts Approved and Pending Approval, so
                    // flipping the status is what releases the days. There is
                    // no separate balance to write.
                    openApp.status = 'Cancelled'
                    openApp.cancelledOn = dayjs().format('YYYY-MM-DDTHH:mm:ss')
                    openApp.cancelledBy = CURRENT_USER
                    setCancelOpen(false)
                    bump()
                    setScreen('manage')
                    flash('Leave application cancelled')
                  }}
                >
                  Yes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* §2.4 / §3 — the reconnect and blocked-navigation pop-ups. */}
        {popup && (
          <div
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 24,
              background: 'rgba(26,26,26,0.92)',
              color: '#fff',
              fontSize: 12,
              borderRadius: 10,
              padding: '10px 14px',
              textAlign: 'center',
              zIndex: 30,
            }}
          >
            {popup}
          </div>
        )}
      </div>

      {/* ---------------- prototype controls, outside the phone ---------------- */}
      <div style={{ width: 260, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Prototype controls</div>
        <div
          style={{
            background: '#fff',
            border: '1px solid #ebedf0',
            borderRadius: 10,
            padding: 14,
            fontSize: 12,
            color: '#595959',
            lineHeight: 1.6,
          }}
        >
          <div style={{ marginBottom: 10 }}>
            Signed in as <strong>{driver.givenName} {driver.familyName}</strong> — {driver.department},{' '}
            {driver.workingDaysPerWeek} working days/week.
          </div>
          <Button size="small" danger={!offline} onClick={() => toggleOffline(!offline)} block>
            {offline ? 'Go back online' : 'Simulate offline'}
          </Button>
          <div style={{ marginTop: 10, fontSize: 11, color: '#8c8c8c' }}>
            Offline shows the fixed banner and blocks navigation with the ticket's pop-up.
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MOVE-2481 — Manage Leave
// ---------------------------------------------------------------------------

function ManageLeave({
  driver,
  applications,
  balances,
  year,
  thisYear,
  onYear,
  onApply,
  onOpen,
}: {
  driver: (typeof LEAVE_EMPLOYEES)[number]
  applications: LeaveApplication[]
  balances: BalanceRow[]
  year: number
  thisYear: number
  onYear: (y: number) => void
  onApply: () => void
  onOpen: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <>
      <ScreenHeader title="Manage Leave" />
      <div style={{ overflowY: 'auto', padding: '0 16px 24px', flex: 1 }}>
        <div style={{ marginTop: 16 }}>
          <Button type="primary" block icon={<PlusOutlined />} onClick={onApply}>
            Apply for Leave
          </Button>
        </div>

        <SectionTitle>Leave Applications</SectionTitle>
        {applications.length === 0 ? (
          // §2 — the exact empty-state copy.
          <div style={{ fontSize: 13, color: '#8c8c8c', textAlign: 'center', padding: '28px 0' }}>
            No leave applications yet.
          </div>
        ) : (
          applications.map((a) => {
            const type = leaveTypeById(a.leaveTypeId)
            const isTimeOff = a.leaveTypeId === 'lt-timeoff'
            return (
              <Card key={a.id} onClick={() => onOpen(a.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{type?.name ?? '-'}</span>
                  <StatusPill status={a.status} />
                </div>
                <div style={{ fontSize: 13, color: '#1a1a1a' }}>
                  {dayjs(a.startDate).format('D MMM YYYY')} - {dayjs(a.endDate).format('D MMM YYYY')}
                </div>
                {/* Sub-text only for time off — the one case the ticket names. */}
                {isTimeOff && a.startTime && (
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 1 }}>
                    {dayjs(a.startTime, 'HH:mm').format('h:mm A')} - {dayjs(a.endTime, 'HH:mm').format('h:mm A')}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: '#8c8c8c' }}>
                  <span>Days Used: {isTimeOff ? '-' : formatDays(a.days)}</span>
                  <span>Applied {dayjs(a.appliedOn).format('D MMM YYYY')}</span>
                </div>
              </Card>
            )
          })
        )}

        <SectionTitle
          right={
            // §2 — this year and next year only, defaulting to this year.
            <div style={{ display: 'flex', background: '#eceef1', borderRadius: 8, padding: 2 }}>
              {[thisYear, thisYear + 1].map((y) => (
                <span
                  key={y}
                  onClick={() => onYear(y)}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: y === year ? '#fff' : 'transparent',
                    color: y === year ? '#1a1a1a' : '#8c8c8c',
                  }}
                >
                  {y}
                </span>
              ))}
            </div>
          }
        >
          Leave Balances
        </SectionTitle>

        {balances.map((r) => {
          // §2 — the expand section exists only for the two annual leave types,
          // and its three rows come straight from MOVE-4137 biz req 1.2.
          const breakdown = entitlementBreakdown(r)
          const open = expanded === r.leaveType.id
          return (
            <Card key={r.leaveType.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{r.leaveType.name}</span>
                {breakdown && (
                  <span
                    onClick={() => setExpanded(open ? null : r.leaveType.id)}
                    style={{ fontSize: 11, color: '#1677ff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {open ? <UpOutlined /> : <DownOutlined />}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{formatValidity(r.validity)}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 8px', marginTop: 12 }}>
                <Mini label="Entitlement" value={r.entitlementDays === null ? '-' : formatDays(r.entitlementDays)} />
                <Mini label="Used" value={formatDays(r.usedDays)} />
                <Mini label="Pending Approval" value={formatDays(r.pendingDays)} />
                <Mini label="Balance" value={r.balance === null ? '-' : formatDays(r.balance)} strong />
              </div>

              {breakdown && open && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e8eaed' }}>
                  <Mini label={`Carried Forward from ${year - 1}`} value={formatDays(breakdown.carriedForward)} row />
                  <Mini label="Entitlement This Year" value={formatDays(breakdown.thisYear)} row />
                  <Mini label="Total Entitlement This Year" value={formatDays(breakdown.total)} row strong />
                </div>
              )}
            </Card>
          )
        })}

        {balances.length === 0 && (
          <div style={{ fontSize: 13, color: '#8c8c8c', textAlign: 'center', padding: '20px 0' }}>
            No leave types are valid for {driver.givenName} in {year}.
          </div>
        )}
      </div>
    </>
  )
}

function Mini({ label, value, strong, row }: { label: string; value: string; strong?: boolean; row?: boolean }) {
  return (
    <div style={row ? { display: 'flex', justifyContent: 'space-between', padding: '3px 0' } : undefined}>
      <div style={{ fontSize: 11, color: '#8c8c8c' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: strong ? 700 : 500, color: '#1a1a1a' }}>{value}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MOVE-4073 — View Leave Application
// ---------------------------------------------------------------------------

function ViewLeaveApplication({
  app,
  onBack,
  onCancel,
}: {
  app: LeaveApplication
  onBack: () => void
  onCancel: () => void
}) {
  const type = leaveTypeById(app.leaveTypeId)
  const isTimeOff = app.leaveTypeId === 'lt-timeoff'
  // MOVE-4075 §1 — the only two statuses that may be cancelled.
  const canCancel = app.status === 'Pending Approval' || app.status === 'Approved'
  const stamp = (v?: string) => (v ? dayjs(v).format('D MMM YYYY, h:mm A') : '-')

  return (
    <>
      <ScreenHeader title="Leave Application" onBack={onBack} />
      <div style={{ overflowY: 'auto', padding: 16, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{type?.name ?? '-'}</span>
          <StatusPill status={app.status} />
        </div>

        <Field
          label="Dates"
          value={
            <>
              {dayjs(app.startDate).format('D MMM YYYY')} - {dayjs(app.endDate).format('D MMM YYYY')}
              {isTimeOff && app.startTime && (
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 400, marginTop: 2 }}>
                  {dayjs(app.startTime, 'HH:mm').format('h:mm A')} - {dayjs(app.endTime, 'HH:mm').format('h:mm A')}
                </div>
              )}
            </>
          }
        />
        <Field label="Days Used" value={isTimeOff ? '-' : formatDays(app.days)} />
        <Field label="Remarks" value={app.remarks || '-'} />
        <Field
          label="Supporting Document"
          value={
            app.documentName ? (
              <a style={{ fontSize: 14 }}>
                <PaperClipOutlined /> {app.documentName}
              </a>
            ) : (
              '-'
            )
          }
        />

        {/* Each block appears only for its own status, per the ticket's table. */}
        {app.status === 'Cancelled' && (
          <>
            <Field label="Cancelled On" value={stamp(app.cancelledOn)} />
            <Field label="Cancelled By" value={app.cancelledBy ?? '-'} />
            <Field label="Reason for Cancellation" value={app.cancellationReason || '-'} />
          </>
        )}
        {app.status === 'Approved' && (
          <>
            <Field label="Approved On" value={stamp(app.approvedOn)} />
            <Field label="Approved By" value={app.approvedBy ?? '-'} />
          </>
        )}
        {app.status === 'Rejected' && (
          <>
            <Field label="Rejected On" value={stamp(app.rejectedOn)} />
            <Field label="Rejected By" value={app.rejectedBy ?? '-'} />
            <Field label="Reason for Rejection" value={app.rejectionReason || '-'} />
          </>
        )}

        <Field label="Created On" value={stamp(app.appliedOn)} />
        <Field label="Created By" value={app.appliedBy} />
      </div>

      {/* MOVE-4075 §1 — greyed out with no action for Rejected / Cancelled. */}
      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0', background: '#fff', flexShrink: 0 }}>
        <Button block danger disabled={!canCancel} onClick={canCancel ? onCancel : undefined}>
          Cancel Leave
        </Button>
        {!canCancel && (
          <div style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'center', marginTop: 6 }}>
            A {app.status.toLowerCase()} application can no longer be cancelled.
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// MOVE-4074 — Apply Leave
// ---------------------------------------------------------------------------

function ApplyLeave({
  driver,
  balances,
  onBack,
  onSubmitted,
}: {
  driver: (typeof LEAVE_EMPLOYEES)[number]
  balances: BalanceRow[]
  onBack: () => void
  onSubmitted: (msg: string) => void
}) {
  const [typeId, setTypeId] = useState<string | null>(null)
  const [start, setStart] = useState<Dayjs | null>(null)
  const [end, setEnd] = useState<Dayjs | null>(null)
  const [startHalf, setStartHalf] = useState<HalfDay>('AM')
  const [endHalf, setEndHalf] = useState<HalfDay>('PM')
  const [times, setTimes] = useState<[Dayjs, Dayjs] | null>(null)
  const [remarks, setRemarks] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const type = typeId ? leaveTypeById(typeId) : undefined
  const isTimeOff = typeId === 'lt-timeoff'
  const docRequired = !!typeId && DOC_REQUIRED_TYPE_IDS.includes(typeId)

  const deduction =
    type && start && end && !isTimeOff
      ? deductionFor(driver, start.format(ISO), end.format(ISO), startHalf, endHalf)
      : null

  const missing =
    !typeId || !start || !end || (isTimeOff && !times) || (docRequired && !fileName)

  const submit = () => {
    setTouched(true)
    if (missing || !type || !start || !end) return
    // No result behaviour is specified in MOVE-4074 — its §4 and AC are pasted
    // from a change-password ticket — so this follows the HR equivalent,
    // MOVE-3777 §4: pending approval, unless the employee has no approver.
    const status: LeaveStatus = driver.leaveApprover ? 'Pending Approval' : 'Approved'
    const now = dayjs()
    LEAVE_APPLICATIONS.unshift({
      id: nextId('la'),
      employeeId: driver.id,
      leaveTypeId: type.id,
      startDate: start.format(ISO),
      endDate: end.format(ISO),
      startHalf,
      endHalf,
      startTime: isTimeOff && times ? times[0].format('HH:mm') : undefined,
      endTime: isTimeOff && times ? times[1].format('HH:mm') : undefined,
      days: isTimeOff ? 0 : deductionFor(driver, start.format(ISO), end.format(ISO), startHalf, endHalf),
      remarks: remarks || undefined,
      documentName: fileName ?? undefined,
      status,
      appliedOn: now.format('YYYY-MM-DDTHH:mm:ss'),
      appliedBy: `${driver.givenName} ${driver.familyName}`,
      approvedOn: status === 'Approved' ? now.format('YYYY-MM-DDTHH:mm:ss') : undefined,
      approvedBy: status === 'Approved' ? 'System (no approver assigned)' : undefined,
    })
    onSubmitted('Leave application submitted')
  }

  const err = (bad: boolean) => (touched && bad ? { borderColor: '#ff4d4f' } : undefined)

  return (
    <>
      <ScreenHeader title="Leave Application" onBack={onBack} />
      <div style={{ overflowY: 'auto', padding: 16, flex: 1 }}>
        <Label required>Leave Type</Label>
        <Select
          style={{ width: '100%', ...err(!typeId) }}
          placeholder="Select leave type"
          value={typeId}
          onChange={(v) => {
            setTypeId(v)
            setTimes(null)
            // Time off is a single day, so the end date follows the start.
            if (v === 'lt-timeoff' && start) setEnd(start)
          }}
          // §2 — only types the driver is eligible for, and eligibility does
          // not depend on the validity period.
          options={balances.map((r) => ({ value: r.leaveType.id, label: r.leaveType.name }))}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <Label required>Start Date</Label>
            <DatePicker
              style={{ width: '100%', ...err(!start) }}
              value={start}
              onChange={(d) => {
                setStart(d)
                if (isTimeOff) setEnd(d)
                if (d && end && end.isBefore(d, 'day')) setEnd(null)
              }}
              // §2 — dates outside the validity period are disabled.
              disabledDate={(d) => (type ? !isSelectableDate(driver, type, d.year(), d) : false)}
            />
            <HalfPicker value={startHalf} onChange={setStartHalf} />
          </div>
          <div style={{ flex: 1 }}>
            <Label required>End Date</Label>
            <DatePicker
              style={{ width: '100%', ...err(!end) }}
              value={end}
              disabled={isTimeOff}
              onChange={setEnd}
              disabledDate={(d) =>
                (start ? d.isBefore(start, 'day') : false) ||
                (type ? !isSelectableDate(driver, type, d.year(), d) : false)
              }
            />
            <HalfPicker value={endHalf} onChange={setEndHalf} />
          </div>
        </div>

        {/* §2 — shown only for time off, and capped at a 2-hour span. */}
        {isTimeOff && (
          <div style={{ marginTop: 14 }}>
            <Label required>Time</Label>
            <TimePicker.RangePicker
              style={{ width: '100%', ...err(!times) }}
              format="h:mm A"
              minuteStep={15}
              value={times}
              onChange={(v) => setTimes(v as [Dayjs, Dayjs] | null)}
            />
            <Hint>Up to 2 hours. Selecting one end limits the other.</Hint>
          </div>
        )}

        {deduction !== null && (
          <div
            style={{
              marginTop: 14,
              background: '#f6f8fa',
              border: '1px solid #e8eaed',
              borderRadius: 10,
              padding: 12,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
            }}
          >
            <span style={{ color: '#595959' }}>To Deduct</span>
            <strong>{formatDays(deduction)}</strong>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <Label>Remarks</Label>
          <Input.TextArea
            rows={3}
            maxLength={120}
            showCount
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <Label required={docRequired}>Supporting Document</Label>
          <Upload
            maxCount={1}
            accept=".pdf,.jpg,.jpeg,.png"
            beforeUpload={(f) => {
              setFileName(f.name)
              return false
            }}
            onRemove={() => setFileName(null)}
          >
            <Button icon={<UploadOutlined />} danger={touched && docRequired && !fileName}>
              Upload
            </Button>
          </Upload>
          <Hint>PDF, JPG or PNG. Max 5MB, one file per application.</Hint>
        </div>
      </div>

      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0', background: '#fff', flexShrink: 0 }}>
        {touched && missing && (
          <div style={{ fontSize: 11, color: '#cf1322', marginBottom: 8, textAlign: 'center' }}>
            Some required fields are missing. Please check and try again.
          </div>
        )}
        <Button type="primary" block onClick={submit}>Submit</Button>
      </div>
    </>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize: 12, color: '#595959', marginBottom: 5 }}>
      {required && <span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>}
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 4 }}>{children}</div>
}

/** §2 — AM/PM sits under each date picker. */
function HalfPicker({ value, onChange }: { value: HalfDay; onChange: (v: HalfDay) => void }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
      {(['AM', 'PM'] as HalfDay[]).map((h) => (
        <label key={h} style={{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="radio" checked={value === h} onChange={() => onChange(h)} />
          {h}
        </label>
      ))}
    </div>
  )
}
