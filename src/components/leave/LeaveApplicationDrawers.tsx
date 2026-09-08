// MOVE-3777 (apply), MOVE-3889 (details), MOVE-3779 (cancel) and MOVE-3893
// (approve/reject) — everything that acts on a leave application.

import { useEffect, useMemo, useState } from 'react'
import {
  Button, DatePicker, Drawer, Dropdown, Input, Modal, Select, Space, Tag, TimePicker, Tooltip, Typography, Upload,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { DownOutlined, PaperClipOutlined, UploadOutlined } from '@ant-design/icons'
import {
  CURRENT_USER,
  LEAVE_APPLICATIONS,
  nextId,
  type HalfDay,
  type LeaveApplication,
  type LeaveEmployee,
  type LeaveStatus,
} from './leaveData'
import {
  availabilityNote,
  balanceRow as balanceRowFor,
  balancesFor,
  deductionFor,
  deductionInYear,
  formatDays,
  isSelectableDate,
  leaveTypeById,
  requiresDocument,
  yearsSpanned,
} from './leaveLogic'

const { Text } = Typography

const HALF_OPTIONS = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
]

export const STATUS_COLOR: Record<LeaveStatus, string> = {
  'Pending Approval': 'default',
  Approved: 'green',
  Rejected: 'red',
  Cancelled: 'default',
}

export function StatusTag({ status }: { status: LeaveStatus }) {
  return <Tag color={STATUS_COLOR[status]} style={{ fontSize: 11, margin: 0 }}>{status}</Tag>
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>{label}</Text>
      {children}
      {hint && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>{hint}</Text>}
    </div>
  )
}

function ReadRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid #f5f5f5' }}>
      <Text style={{ fontSize: 12, color: '#8c8c8c', width: 150, flexShrink: 0 }}>{label}</Text>
      <div style={{ fontSize: 13, minWidth: 0 }}>{value}</div>
    </div>
  )
}

const TIME_OFF_ID = 'lt-timeoff'

// ---------------------------------------------------------------------------
// MOVE-3777 — Apply for leave
// ---------------------------------------------------------------------------

export function ApplyLeaveDrawer({
  open,
  employee,
  year,
  onClose,
  onSaved,
}: {
  open: boolean
  employee: LeaveEmployee
  year: number
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [leaveTypeId, setLeaveTypeId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<Dayjs | null>(null)
  const [endDate, setEndDate] = useState<Dayjs | null>(null)
  const [startHalf, setStartHalf] = useState<HalfDay>('AM')
  const [endHalf, setEndHalf] = useState<HalfDay>('PM')
  const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [remarks, setRemarks] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  // Biz req 2 — the dropdown lists exactly the types on the employee's profile,
  // regardless of whether each one's validity window is open today.
  const rows = useMemo(() => (open ? balancesFor(employee, year) : []), [employee, year, open])
  const type = leaveTypeId ? leaveTypeById(leaveTypeId) : undefined
  const isTimeOff = leaveTypeId === TIME_OFF_ID

  useEffect(() => {
    if (!open) return
    setLeaveTypeId(null); setStartDate(null); setEndDate(null)
    setStartHalf('AM'); setEndHalf('PM'); setTimeRange(null)
    setRemarks(''); setFileName(null); setTouched(false)
  }, [open])

  // Biz req 2 — Time Off is a single day, so the end date follows the start.
  useEffect(() => {
    if (isTimeOff && startDate) setEndDate(startDate)
  }, [isTimeOff, startDate])

  /**
   * Biz req 2 — dates outside the type's validity period are not selectable.
   * For a recurring type that means the viewing year's window *or* the next
   * one, which is what lets biz req 3's cross-year example be entered at all.
   */
  const outsideValidity = (d: Dayjs) => (type ? !isSelectableDate(employee, type, year, d) : false)

  const deduction =
    startDate && endDate && !isTimeOff
      ? deductionFor(employee, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), startHalf, endHalf)
      : 0

  // Biz req 3 — an application spanning two years shows one balance per year,
  // each computed against that year's own entitlement.
  const spannedYears = startDate && endDate ? yearsSpanned(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')) : []
  const yearBlocks =
    !type || isTimeOff || !startDate || !endDate
      ? []
      : spannedYears
          .map((y) => {
            const r = balanceRowFor(employee, type.id, y)
            return { year: y, row: r }
          })
          .filter((x) => !!x.row && x.row.entitlementDays !== null)
          .map(({ year: y, row: r }) => {
            const ded = deductionInYear(
              employee,
              startDate.format('YYYY-MM-DD'),
              endDate.format('YYYY-MM-DD'),
              startHalf,
              endHalf,
              y,
            )
            const avail = r!.balance ?? 0
            return { year: y, validity: r!.validity, available: avail, deduction: ded, projected: avail - ded }
          })

  // Biz req 2 — no balance block for types with no entitlement at all.
  const showBalance = yearBlocks.length > 0

  const docRequired = !!type && requiresDocument(type)
  const missing =
    !leaveTypeId ||
    !startDate ||
    !endDate ||
    (isTimeOff && !timeRange) ||
    (docRequired && !fileName)

  const submit = () => {
    setTouched(true)
    if (missing || !type) return
    // Biz req 4.1 — an employee with no leave approver gets approved leave.
    const autoApprove = !employee.leaveApprover
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    const app: LeaveApplication = {
      id: nextId('la'),
      employeeId: employee.id,
      leaveTypeId: type.id,
      startDate: startDate!.format('YYYY-MM-DD'),
      endDate: endDate!.format('YYYY-MM-DD'),
      startHalf: isTimeOff ? 'AM' : startHalf,
      endHalf: isTimeOff ? 'AM' : endHalf,
      startTime: isTimeOff && timeRange ? timeRange[0].format('HH:mm') : undefined,
      endTime: isTimeOff && timeRange ? timeRange[1].format('HH:mm') : undefined,
      days: isTimeOff ? 0 : deduction,
      remarks: remarks.trim() || undefined,
      documentName: fileName ?? undefined,
      status: autoApprove ? 'Approved' : 'Pending Approval',
      appliedOn: now,
      appliedBy: CURRENT_USER,
      approvedOn: autoApprove ? now : undefined,
      approvedBy: autoApprove ? 'System (no approver assigned)' : undefined,
    }
    LEAVE_APPLICATIONS.unshift(app)
    onSaved(
      autoApprove
        ? `${type.name} approved automatically — ${employee.givenName} has no leave approver assigned.`
        : `${type.name} sent for approval.`,
    )
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      title="Apply for Leave"
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={submit}>Send for Approval</Button>
        </Space>
      }
    >
      <Field label="Leave Type">
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Select leave type"
          style={{ width: '100%' }}
          value={leaveTypeId}
          onChange={(v) => { setLeaveTypeId(v); setStartDate(null); setEndDate(null) }}
          status={touched && !leaveTypeId ? 'error' : undefined}
          options={rows.map((r) => ({ value: r.leaveType.id, label: r.leaveType.name }))}
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Start Date">
          <Space.Compact style={{ width: '100%' }}>
            <DatePicker
              style={{ width: '65%' }}
              value={startDate}
              onChange={setStartDate}
              disabled={!leaveTypeId}
              disabledDate={outsideValidity}
              status={touched && !startDate ? 'error' : undefined}
            />
            <Select
              style={{ width: '35%' }}
              value={startHalf}
              onChange={(v) => setStartHalf(v as HalfDay)}
              options={HALF_OPTIONS}
              disabled={isTimeOff}
            />
          </Space.Compact>
        </Field>
        <Field label="End Date" hint={isTimeOff ? 'Time Off is a single day' : undefined}>
          <Space.Compact style={{ width: '100%' }}>
            <DatePicker
              style={{ width: '65%' }}
              value={endDate}
              onChange={setEndDate}
              disabled={!leaveTypeId || isTimeOff}
              disabledDate={(d) => outsideValidity(d) || (!!startDate && d.isBefore(startDate, 'day'))}
              status={touched && !endDate ? 'error' : undefined}
            />
            <Select
              style={{ width: '35%' }}
              value={endHalf}
              onChange={(v) => setEndHalf(v as HalfDay)}
              options={HALF_OPTIONS}
              disabled={isTimeOff}
            />
          </Space.Compact>
        </Field>
      </div>

      {/* Biz req 2 — Time Off is capped at two hours, so the picker enforces it
          rather than letting a wrong range be submitted and rejected. */}
      {isTimeOff && (
        <Field label="Time" hint="Time Off is limited to 2 hours.">
          <TimePicker.RangePicker
            format="HH:mm"
            minuteStep={15}
            style={{ width: '100%' }}
            value={timeRange}
            onChange={(v) => {
              const r = v as [Dayjs, Dayjs] | null
              if (r && r[1].diff(r[0], 'minute') > 120) {
                setTimeRange([r[0], r[0].add(2, 'hour')])
              } else {
                setTimeRange(r)
              }
            }}
            status={touched && !timeRange ? 'error' : undefined}
          />
        </Field>
      )}

      {/* Biz req 3 — hidden until there is something real to compute. When the
          period crosses a year boundary this renders one block per year, which
          is what the ticket's 24 Dec – 5 Jan example asks for. */}
      {showBalance && (
        <div style={{ marginBottom: 16 }}>
          {yearBlocks.map((blk) => (
            <div
              key={blk.year}
              style={{
                background: '#f6f8fa',
                border: '1px solid #e8eaed',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 8,
              }}
            >
              {yearBlocks.length > 1 && (
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{blk.year}</Text>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: '#595959' }}>Available</Text>
                <Text style={{ fontSize: 12 }}>
                  {formatDays(blk.available)}
                  {blk.validity.effective && (
                    <Text type="secondary" style={{ fontSize: 11 }}>, {availabilityNote(blk.validity)}</Text>
                  )}
                </Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: '#595959' }}>Deduction</Text>
                <Text style={{ fontSize: 12 }}>{formatDays(blk.deduction)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid #e8eaed' }}>
                <Text strong style={{ fontSize: 12 }}>Balance</Text>
                <Text strong style={{ fontSize: 12, color: blk.projected < 0 ? '#cf1322' : '#1a1a1a' }}>
                  {formatDays(blk.projected)}
                </Text>
              </div>
              {/* Biz req 3 — a negative balance is allowed, but it has a cost,
                  and the drawer says what it is rather than blocking the submit. */}
              {blk.projected < 0 && (
                <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
                  {Math.abs(blk.projected)} day{Math.abs(blk.projected) === 1 ? '' : 's'} will be taken as unpaid leave and deducted from payroll.
                </Text>
              )}
            </div>
          ))}
          {employee.workingDaysPerWeek >= 5.5 && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              {employee.givenName} works {employee.workingDaysPerWeek} days a week, so a full weekend inside the period costs a day.
            </Text>
          )}
        </div>
      )}

      <Field label="Remarks">
        <Input.TextArea
          rows={2}
          maxLength={120}
          showCount
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Optional"
        />
      </Field>

      <Field
        label={`Supporting Document${docRequired ? '' : ' (optional)'}`}
        hint="PDF, JPG or PNG, up to 5MB. One file per application."
      >
        <Upload
          maxCount={1}
          accept=".pdf,.jpg,.jpeg,.png"
          beforeUpload={(file) => {
            setFileName(file.name)
            // Nothing is uploaded anywhere — this prototype has no backend, so
            // the file is recorded by name only.
            return false
          }}
          onRemove={() => setFileName(null)}
          fileList={fileName ? [{ uid: '1', name: fileName, status: 'done' as const }] : []}
        >
          <Button icon={<UploadOutlined />} danger={touched && docRequired && !fileName}>
            Select file
          </Button>
        </Upload>
        {touched && docRequired && !fileName && (
          <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            {type?.name} requires a supporting document.
          </Text>
        )}
      </Field>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// MOVE-3889 — Leave application details, with MOVE-3779 / MOVE-3893 actions
// ---------------------------------------------------------------------------

type PendingAction = 'approve' | 'reject' | 'cancel'

const ACTION_COPY: Record<PendingAction, { title: string; body: string; ok: string; danger: boolean }> = {
  approve: {
    title: 'Approve leave application?',
    body: 'The days will move from pending approval into used, and the employee’s balance updates immediately.',
    ok: 'Confirm',
    danger: false,
  },
  reject: {
    title: 'Reject leave application?',
    body: 'The days will be released back into the employee’s balance. A rejected application cannot be cancelled afterwards.',
    ok: 'Confirm',
    danger: true,
  },
  cancel: {
    title: 'Cancel leave application?',
    body: 'The days will be released back into the employee’s balance. The application stays on the record as cancelled.',
    ok: 'Confirm',
    danger: true,
  },
}

export function LeaveApplicationDrawer({
  application,
  employee,
  onClose,
  onChanged,
}: {
  application: LeaveApplication | null
  employee: LeaveEmployee
  onClose: () => void
  onChanged: (message: string) => void
}) {
  const [pending, setPending] = useState<PendingAction | null>(null)

  if (!application) return <Drawer open={false} onClose={onClose} />
  const app = application
  const type = leaveTypeById(app.leaveTypeId)
  const isTimeOff = app.leaveTypeId === TIME_OFF_ID

  const canApproveReject = app.status === 'Pending Approval'
  // MOVE-3779 — cancelling is allowed while pending or already approved.
  const canCancel = app.status === 'Pending Approval' || app.status === 'Approved'

  const apply = (action: PendingAction) => {
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    if (action === 'approve') {
      app.status = 'Approved'
      app.approvedOn = now
      app.approvedBy = CURRENT_USER
    } else if (action === 'reject') {
      app.status = 'Rejected'
      app.rejectedOn = now
      app.rejectedBy = CURRENT_USER
    } else {
      app.status = 'Cancelled'
      app.cancelledOn = now
      app.cancelledBy = CURRENT_USER
    }
    setPending(null)
    // Balances recompute from status, so nothing else has to be adjusted here.
    onChanged(`Leave application ${app.status.toLowerCase()}.`)
    if (action === 'cancel') onClose()
  }

  /**
   * MOVE-3779 biz req 1 and MOVE-3893 biz req 1 both say the action is disabled
   * *with a tooltip* when the status does not allow it — a greyed row with no
   * explanation is the thing they are asking us not to ship. AntD does not fire
   * hover events on a disabled menu item, so the tooltip wraps the label.
   */
  const item = (key: PendingAction, label: string, allowed: boolean, why: string, danger = false) => ({
    key,
    disabled: !allowed,
    danger: danger && allowed,
    label: allowed ? (
      <span>{label}</span>
    ) : (
      <Tooltip title={why} placement="left">
        <span style={{ display: 'block' }}>{label}</span>
      </Tooltip>
    ),
  })

  const statusWord = app.status.toLowerCase()
  const menuItems = [
    item('approve', 'Approve Leave', canApproveReject, `Only a pending application can be approved — this one is ${statusWord}.`),
    item('reject', 'Reject Leave', canApproveReject, `Only a pending application can be rejected — this one is ${statusWord}.`),
    item('cancel', 'Cancel Leave', canCancel, `A ${statusWord} application cannot be cancelled.`, true),
  ]

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width={480}
        title={
          <Space>
            <span>{type?.name ?? 'Leave'}</span>
            <StatusTag status={app.status} />
          </Space>
        }
        // Biz req 2 — no primary CTA; everything sits under an actions menu.
        extra={
          <Dropdown
            menu={{ items: menuItems, onClick: ({ key }) => setPending(key as PendingAction) }}
            trigger={['click']}
          >
            <Button>
              Actions <DownOutlined />
            </Button>
          </Dropdown>
        }
      >
        {!canApproveReject && !canCancel && (
          <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 12px', marginBottom: 14 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              This application is {statusWord}, so no further action can be taken on it.
            </Text>
          </div>
        )}

        <ReadRow
          label="Dates"
          value={
            <div>
              <Text style={{ fontSize: 13, display: 'block' }}>
                {dayjs(app.startDate).format('D MMM YYYY')} - {dayjs(app.endDate).format('D MMM YYYY')}
              </Text>
              {isTimeOff && app.startTime && (
                <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                  {dayjs(app.startTime, 'HH:mm').format('h:mm A')} - {dayjs(app.endTime, 'HH:mm').format('h:mm A')}
                </Text>
              )}
            </div>
          }
        />
        {/* Biz req 1 — Time Off has no day count, so it prints a dash. */}
        <ReadRow label="Days Used" value={isTimeOff ? '-' : formatDays(app.days)} />
        <ReadRow label="Remarks" value={app.remarks || '-'} />
        <ReadRow
          label="Supporting Document"
          value={
            app.documentName ? (
              <Tooltip title="This prototype records the file name only — there is nothing to download.">
                <Space size={4}>
                  <PaperClipOutlined style={{ color: '#1677ff' }} />
                  <Text style={{ fontSize: 13, color: '#1677ff' }}>{app.documentName}</Text>
                </Space>
              </Tooltip>
            ) : (
              '-'
            )
          }
        />

        <div style={{ height: 20 }} />
        <Text style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600 }}>Additional Information</Text>
        <div style={{ marginTop: 8 }}>
          <ReadRow label="Applied On" value={dayjs(app.appliedOn).format('D MMM YYYY, h:mm A')} />
          <ReadRow label="Applied By" value={app.appliedBy} />
          {/* Biz req 1 — each pair shows only for its own status. */}
          {app.status === 'Approved' && (
            <>
              <ReadRow label="Approved On" value={app.approvedOn ? dayjs(app.approvedOn).format('D MMM YYYY, h:mm A') : '-'} />
              <ReadRow label="Approved By" value={app.approvedBy ?? '-'} />
            </>
          )}
          {app.status === 'Rejected' && (
            <>
              <ReadRow label="Rejected On" value={app.rejectedOn ? dayjs(app.rejectedOn).format('D MMM YYYY, h:mm A') : '-'} />
              <ReadRow label="Rejected By" value={app.rejectedBy ?? '-'} />
            </>
          )}
          {app.status === 'Cancelled' && (
            <>
              <ReadRow label="Cancelled On" value={app.cancelledOn ? dayjs(app.cancelledOn).format('D MMM YYYY, h:mm A') : '-'} />
              <ReadRow label="Cancelled By" value={app.cancelledBy ?? '-'} />
            </>
          )}
          <ReadRow label="Employee" value={`${employee.givenName} ${employee.familyName}`} />
        </div>
      </Drawer>

      <Modal
        open={!!pending}
        onCancel={() => setPending(null)}
        title={pending ? ACTION_COPY[pending].title : ''}
        okText={pending ? ACTION_COPY[pending].ok : 'Confirm'}
        okButtonProps={{ danger: pending ? ACTION_COPY[pending].danger : false }}
        onOk={() => pending && apply(pending)}
      >
        <Text style={{ fontSize: 13 }}>{pending ? ACTION_COPY[pending].body : ''}</Text>
      </Modal>
    </>
  )
}
