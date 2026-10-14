// Personal Dashboard (epic MOVE-3412) — Leave drawers.
//
// Deliberately independent of `leave/LeaveApplicationDrawers.tsx` and of
// `personaldashboard/PersonalDashboardLeaveTab.tsx`: the user asked for this
// build to share no component with the personal-dashboard surface built
// earlier, since that one gets reworked separately. So every piece of UI
// here — the Apply Leave form, the details drawer, the confirm modals — is
// its own fresh AntD implementation.
//
// What IS shared is the business-rule engine one directory over
// (`leave/leaveData.ts`, `leave/leaveLogic.ts`): the mock database and the
// carry-forward / pro-ration / deduction rules. That is not "the personal
// dashboard already built" — it is the Leave module's single source of
// truth, the same one the HR pages and the driver app read from. Recomputing
// those rules a second time here would be the one sure way to make this
// page's numbers disagree with the rest of the app.
//
//   MOVE-3946  Create Leave Application (Drawer) — "same fields/logic as MOVE-3777"
//   MOVE-3950  Cancel Leave Application            — "same as MOVE-3779"
//   MOVE-3952  Approve/Reject Leave Applications (For Approvers)
//   MOVE-3956  Auto-approve if Leave Approver = Not Applicable
//   MOVE-3965  Leave Application Details Drawer

import { useEffect, useMemo, useState } from 'react'
import {
  Button, DatePicker, Divider, Drawer, Dropdown, Form, Input, Modal, Select, Space, Tag, TimePicker, Tooltip, Typography, Upload, message,
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
} from '../leave/leaveData'
import {
  ISO,
  balanceRow as balanceRowFor,
  balancesFor,
  deductionFor,
  deductionInYear,
  availabilityNote,
  formatDays,
  isSelectableDate,
  leaveTypeById,
  requiresDocument,
  yearsSpanned,
} from '../leave/leaveLogic'

const { Text } = Typography

// Matches the "Leave Type Detail Drawer" Figma component's Basic/Additional
// Information pattern (also used by ContractDetailPage.tsx etc.) — section
// header + paired label/bold-value cells, divider between rows.
const SECTION_TITLE: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 16, display: 'block' }
const LBL: React.CSSProperties = { fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 3 }
const VAL: React.CSSProperties = { fontSize: 13, display: 'block', fontWeight: 600, color: '#1a1a1a' }

type DetailCell = { label: string; value: React.ReactNode }

/** One row of the Basic/Additional Information pattern — 1 or 2 cells, divider unless `last`. */
function DetailRow({ cells, last }: { cells: DetailCell[]; last?: boolean }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px', padding: '0 0 16px' }}>
        {cells.map((c, i) => (
          <div key={i}>
            <Text style={LBL}>{c.label}</Text>
            <Text style={VAL}>{c.value}</Text>
          </div>
        ))}
      </div>
      {!last && <Divider style={{ margin: '0 0 16px' }} />}
    </>
  )
}

const TIME_OFF_ID = 'lt-timeoff'

const HALF_OPTIONS = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
]

export const STATUS_TAG_COLOR: Record<LeaveStatus, string> = {
  'Pending Approval': 'gold',
  Approved: 'green',
  Rejected: 'red',
  Cancelled: 'default',
}

export function LeaveStatusTag({ status }: { status: LeaveStatus }) {
  return <Tag color={STATUS_TAG_COLOR[status]}>{status}</Tag>
}

// ---------------------------------------------------------------------------
// MOVE-3946 — Create Leave Application
// ---------------------------------------------------------------------------

interface ApplyFormValues {
  leaveTypeId: string
  startDate: Dayjs
  startHalf: HalfDay
  endDate: Dayjs
  endHalf: HalfDay
  timeRange?: [Dayjs, Dayjs]
  remarks?: string
}

export function CreateLeaveApplicationDrawer({
  open,
  employee,
  year,
  onClose,
  onCreated,
}: {
  open: boolean
  employee: LeaveEmployee
  year: number
  onClose: () => void
  onCreated: (message: string) => void
}) {
  const [form] = Form.useForm<ApplyFormValues>()
  const [fileName, setFileName] = useState<string | null>(null)

  // MOVE-3946 §2 — the options are the employee's eligible leave types, taken
  // from the same balances table the Leave tab shows, and biz req 2 is
  // explicit that this does not depend on the validity window: a type that
  // only opens up later in the year still belongs in the dropdown now.
  const eligibleTypes = useMemo(() => balancesFor(employee, year).map((r) => r.leaveType), [employee, year])

  const leaveTypeId = Form.useWatch('leaveTypeId', form)
  const startDate = Form.useWatch('startDate', form)
  const endDate = Form.useWatch('endDate', form)
  const startHalf = Form.useWatch('startHalf', form) ?? 'AM'
  const endHalf = Form.useWatch('endHalf', form) ?? 'PM'

  const type = leaveTypeId ? leaveTypeById(leaveTypeId) : undefined
  const isTimeOff = leaveTypeId === TIME_OFF_ID
  const docRequired = type ? requiresDocument(type) : false

  useEffect(() => {
    if (!open) {
      form.resetFields()
      setFileName(null)
    }
  }, [open, form])

  // Time off is a single day — the end date always follows the start.
  useEffect(() => {
    if (isTimeOff && startDate) form.setFieldValue('endDate', startDate)
  }, [isTimeOff, startDate, form])

  // MOVE-3946 §2 ("same fields and logic as MOVE-3777") — MOVE-3777's 23 Sep
  // 2026 revision clears a stale end date whenever the start date changes,
  // same as the leave-module drawer this one must match.
  useEffect(() => {
    if (isTimeOff) return
    form.setFieldValue('endDate', undefined)
    form.setFieldValue('endHalf', 'PM')
  }, [startDate, isTimeOff, form])

  /** Same rule as the leave-module drawer: dates outside the type's validity
   * period (the viewing year's window, or the next one) are not selectable. */
  const outsideValidity = (d: Dayjs) => (type ? !isSelectableDate(employee, type, year, d) : false)

  // MOVE-3777 biz req 3 — an application spanning two years shows one
  // balance block per year, each computed against that year's own
  // entitlement.
  const spannedYears = startDate && endDate ? yearsSpanned(startDate.format(ISO), endDate.format(ISO)) : []
  const yearBlocks =
    !type || isTimeOff || !startDate || !endDate
      ? []
      : spannedYears
          .map((y) => ({ year: y, row: balanceRowFor(employee, type.id, y) }))
          .filter((x) => !!x.row && x.row.entitlementDays !== null)
          .map(({ year: y, row: r }) => {
            const ded = deductionInYear(employee, startDate.format(ISO), endDate.format(ISO), startHalf, endHalf, y)
            const avail = r!.balance ?? 0
            return { year: y, validity: r!.validity, available: avail, deduction: ded, projected: avail - ded }
          })
  const showBalance = yearBlocks.length > 0

  const submit = async () => {
    let values: ApplyFormValues
    try {
      values = await form.validateFields()
    } catch {
      // Create Leave Type pattern (FIGMA_DESIGN_SYSTEM.md §3.4) — an invalid
      // submit gets a toast, not just AntD's own silent field-scroll.
      message.error('Unable to send leave application — please fill in all required fields')
      return
    }
    if (docRequired && !fileName) {
      // The inline "requires a supporting document" text below the Upload
      // already shows unconditionally once a doc-required type is picked —
      // this used to also call form.setFields with an empty error array on
      // an unrelated field, which did nothing visible. A toast is the one
      // piece that was actually missing.
      message.error('Unable to send leave application — a supporting document is required')
      return
    }
    const approver = employee.leaveApprover
    // MOVE-3956 — no approver on file means the application is created
    // already approved, rather than sitting pending forever.
    const status: LeaveStatus = approver ? 'Pending Approval' : 'Approved'
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    LEAVE_APPLICATIONS.unshift({
      id: nextId('la'),
      employeeId: employee.id,
      leaveTypeId: values.leaveTypeId,
      startDate: values.startDate.format(ISO),
      endDate: values.endDate.format(ISO),
      startHalf: values.startHalf,
      endHalf: values.endHalf,
      startTime: isTimeOff && values.timeRange ? values.timeRange[0].format('HH:mm') : undefined,
      endTime: isTimeOff && values.timeRange ? values.timeRange[1].format('HH:mm') : undefined,
      days: isTimeOff
        ? 0
        : deductionFor(employee, values.startDate.format(ISO), values.endDate.format(ISO), values.startHalf, values.endHalf),
      remarks: values.remarks || undefined,
      documentName: fileName ?? undefined,
      status,
      appliedOn: now,
      appliedBy: `${employee.givenName} ${employee.familyName}`, // self-service: the employee applies for themselves
      approvedOn: status === 'Approved' ? now : undefined,
      approvedBy: status === 'Approved' ? 'System (no approver assigned)' : undefined,
    })
    onCreated(`Leave application ${status === 'Approved' ? 'created and approved' : 'sent for approval'}.`)
  }

  return (
    <Drawer
      title="Apply for Leave"
      open={open}
      onClose={onClose}
      width={480}
      // MOVE-3946 §2 — "Send for Approval" primary, "Cancel" secondary.
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={submit}>Send for Approval</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ startHalf: 'AM', endHalf: 'PM' }}>
        <Form.Item name="leaveTypeId" label="Leave Type" rules={[{ required: true, message: 'Select a leave type.' }]}>
          <Select
            placeholder="Select leave type"
            showSearch
            optionFilterProp="label"
            options={eligibleTypes.map((t) => ({ value: t.id, label: t.name }))}
          />
        </Form.Item>

        {/* MOVE-3946 §2 ("same fields and logic as MOVE-3777") — two separate
            Start Date / End Date fields, each paired with its own AM/PM half,
            split evenly (FIGMA_DESIGN_SYSTEM.md §3.4), not a single Range
            Picker under one "Leave Application Period" label. Every field but
            Leave Type starts disabled until a type is picked. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label="Start Date" required style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item name="startDate" noStyle rules={[{ required: true, message: 'Select the start date.' }]}>
                <DatePicker style={{ flex: 1, minWidth: 0 }} disabled={!leaveTypeId} disabledDate={outsideValidity} />
              </Form.Item>
              <Form.Item name="startHalf" noStyle>
                <Select style={{ width: 90, flexShrink: 0 }} options={HALF_OPTIONS} disabled={!leaveTypeId || isTimeOff} />
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item label="End Date" required style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item name="endDate" noStyle rules={[{ required: true, message: 'Select the end date.' }]}>
                <DatePicker
                  style={{ flex: 1, minWidth: 0 }}
                  disabled={!leaveTypeId || isTimeOff}
                  disabledDate={(d) => outsideValidity(d) || (!!startDate && d.isBefore(startDate, 'day'))}
                />
              </Form.Item>
              <Form.Item name="endHalf" noStyle>
                <Select style={{ width: 90, flexShrink: 0 }} options={HALF_OPTIONS} disabled={!leaveTypeId || isTimeOff} />
              </Form.Item>
            </div>
          </Form.Item>
        </div>

        {/* MOVE-3946 §2 row 3 — only for Time Off, hidden otherwise. */}
        {isTimeOff && (
          <Form.Item
            name="timeRange"
            label="Time"
            style={{ marginTop: 20 }}
            rules={[{ required: true, message: 'Select a start and end time.' }]}
          >
            <TimePicker.RangePicker style={{ width: '100%' }} format="h:mm A" minuteStep={15} />
          </Form.Item>
        )}

        {/* MOVE-3777 biz req 3 — hidden until there is something real to
            compute; one block per year the period touches, each with its own
            Available / To Deduct / Balance, matching the leave-module drawer. */}
        {showBalance && (
          <div style={{ marginBottom: 16, marginTop: 20 }}>
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
                  <Text style={{ fontSize: 12, color: '#595959' }}>To Deduct</Text>
                  <Text style={{ fontSize: 12 }}>{formatDays(blk.deduction)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid #e8eaed' }}>
                  <Text strong style={{ fontSize: 12 }}>Balance</Text>
                  <Text strong style={{ fontSize: 12, color: blk.projected < 0 ? '#cf1322' : '#1a1a1a' }}>
                    {formatDays(blk.projected)}
                  </Text>
                </div>
                {blk.projected < 0 && (
                  <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
                    {Math.abs(blk.projected)} day{Math.abs(blk.projected) === 1 ? '' : 's'} will be taken as unpaid leave and deducted from payroll.
                  </Text>
                )}
              </div>
            ))}
          </div>
        )}

        <Form.Item name="remarks" label="Remarks">
          <Input.TextArea rows={3} maxLength={120} showCount disabled={!leaveTypeId} />
        </Form.Item>

        <Form.Item label={`Supporting Document${docRequired ? '' : ' (optional)'}`}>
          <Upload
            maxCount={1}
            accept=".pdf,.jpg,.jpeg,.png"
            disabled={!leaveTypeId}
            beforeUpload={(file) => { setFileName(file.name); return false }}
            onRemove={() => setFileName(null)}
            fileList={fileName ? [{ uid: '1', name: fileName, status: 'done' as const }] : []}
          >
            <Button icon={<UploadOutlined />} disabled={!leaveTypeId}>Select file</Button>
          </Upload>
          {docRequired && !fileName && (
            <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              {type?.name} requires a supporting document.
            </Text>
          )}
        </Form.Item>
      </Form>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// MOVE-3965 — Leave Application Details Drawer, with MOVE-3950 / MOVE-3952
// ---------------------------------------------------------------------------

type Action = 'approve' | 'reject' | 'cancel'

export function LeaveApplicationDetailsDrawer({
  application,
  employee,
  /** True when opened from the Approvals tab (someone else's leave) — Approve/Reject, never Cancel. */
  canDecide,
  /** Who is acting — the signed-in employee, written to Approved/Rejected/Cancelled By. */
  actorName = CURRENT_USER,
  onClose,
  onChanged,
}: {
  application: LeaveApplication | null
  employee: LeaveEmployee
  canDecide: boolean
  actorName?: string
  onClose: () => void
  onChanged: (message: string) => void
}) {
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')

  if (!application) return null
  const app = application
  const type = leaveTypeById(app.leaveTypeId)
  const isTimeOff = app.leaveTypeId === TIME_OFF_ID

  // MOVE-3950 (13 Oct 2026 edit) — Cancel is the applicant's own secondary
  // CTA: enabled only while pending approval / approved AND the leave dates
  // have not started; otherwise shown disabled with a tooltip. On someone
  // else's leave (canDecide) there is no Cancel button at all.
  const statusAllowsCancel = app.status === 'Pending Approval' || app.status === 'Approved'
  const notStarted = dayjs(app.startDate).isAfter(dayjs(), 'day')
  const canCancel = statusAllowsCancel && notStarted
  const cancelWhy = !statusAllowsCancel
    ? `Only a leave application that is pending approval or approved can be cancelled — this one is ${app.status.toLowerCase()}.`
    : 'This leave has already started, so it can no longer be cancelled here.'
  // MOVE-3952 — Approve/Reject sit under an Actions dropdown, enabled only
  // while pending approval, disabled with a tooltip otherwise.
  const canApproveReject = canDecide && app.status === 'Pending Approval'
  const decideWhy = `Only a leave application pending approval can be approved or rejected — this one is ${app.status.toLowerCase()}.`
  const decideItem = (key: 'approve' | 'reject', label: string) => ({
    key,
    disabled: !canApproveReject,
    danger: key === 'reject' && canApproveReject,
    label: canApproveReject ? label : (
      <Tooltip title={decideWhy} placement="left"><span style={{ display: 'block' }}>{label}</span></Tooltip>
    ),
  })

  const openAction = (a: Action) => { setAction(a); setReason('') }

  const confirm = () => {
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    if (action === 'approve') {
      app.status = 'Approved'
      app.approvedOn = now
      app.approvedBy = actorName
    } else if (action === 'reject') {
      app.status = 'Rejected'
      app.rejectedOn = now
      app.rejectedBy = actorName
      app.rejectionReason = reason.trim()
    } else if (action === 'cancel') {
      app.status = 'Cancelled'
      app.cancelledOn = now
      app.cancelledBy = actorName
      app.cancellationReason = reason.trim() || undefined
    }
    setAction(null)
    onChanged(`Leave application ${app.status.toLowerCase()}.`)
  }

  const ACTION_COPY: Record<Action, { title: string; okDanger: boolean; requireReason: boolean }> = {
    approve: { title: 'Approve this leave application?', okDanger: false, requireReason: false },
    reject: { title: 'Reject this leave application?', okDanger: true, requireReason: true },
    cancel: { title: 'Cancel this leave application?', okDanger: true, requireReason: false },
  }

  return (
    <>
      <Drawer
        title={
          <Space>
            <span>{type?.name ?? 'Leave'}</span>
            <LeaveStatusTag status={app.status} />
          </Space>
        }
        open
        onClose={onClose}
        width={480}
        // MOVE-3965 — no primary CTA. Own leave: Cancel (secondary CTA).
        // Someone else's leave: Approve / Reject under an Actions dropdown.
        extra={
          canDecide ? (
            <Dropdown
              trigger={['click']}
              menu={{ items: [decideItem('approve', 'Approve'), decideItem('reject', 'Reject')], onClick: ({ key }) => openAction(key as Action) }}
            >
              <Button>Actions <DownOutlined /></Button>
            </Dropdown>
          ) : canCancel ? (
            <Button onClick={() => openAction('cancel')}>Cancel</Button>
          ) : (
            <Tooltip title={cancelWhy} placement="bottomRight">
              <Button disabled>Cancel</Button>
            </Tooltip>
          )
        }
      >
        {(() => {
          const basicRows: DetailCell[][] = [
            [
              {
                label: 'Dates',
                value: (
                  <>
                    {dayjs(app.startDate).format('D MMM YYYY')} - {dayjs(app.endDate).format('D MMM YYYY')}
                    {isTimeOff && app.startTime && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                          {dayjs(app.startTime, 'HH:mm').format('h:mm A')} - {dayjs(app.endTime, 'HH:mm').format('h:mm A')}
                        </Text>
                      </div>
                    )}
                  </>
                ),
              },
              { label: 'Days Used', value: isTimeOff ? '-' : formatDays(app.days) },
            ],
            [
              { label: 'Remarks', value: app.remarks || '-' },
              {
                label: 'Supporting Document',
                value: app.documentName ? (
                  <Tooltip title="Prototype — the file name is recorded, nothing to download.">
                    <Space size={4}><PaperClipOutlined />{app.documentName}</Space>
                  </Tooltip>
                ) : '-',
              },
            ],
          ]

          const additionalRows: DetailCell[][] = [
            [
              { label: 'Created On', value: dayjs(app.appliedOn).format('D MMM YYYY, h:mm A') },
              { label: 'Created By', value: app.appliedBy },
            ],
          ]
          if (app.status === 'Approved') {
            additionalRows.push([
              { label: 'Approved On', value: app.approvedOn ? dayjs(app.approvedOn).format('D MMM YYYY, h:mm A') : '-' },
              { label: 'Approved By', value: app.approvedBy ?? '-' },
            ])
          } else if (app.status === 'Rejected') {
            additionalRows.push([
              { label: 'Rejected On', value: app.rejectedOn ? dayjs(app.rejectedOn).format('D MMM YYYY, h:mm A') : '-' },
              { label: 'Rejected By', value: app.rejectedBy ?? '-' },
            ])
            additionalRows.push([{ label: 'Reason for Rejection', value: app.rejectionReason || '-' }])
          } else if (app.status === 'Cancelled') {
            additionalRows.push([
              { label: 'Cancelled On', value: app.cancelledOn ? dayjs(app.cancelledOn).format('D MMM YYYY, h:mm A') : '-' },
              { label: 'Cancelled By', value: app.cancelledBy ?? '-' },
            ])
            additionalRows.push([{ label: 'Reason for Cancellation', value: app.cancellationReason || '-' }])
          }
          additionalRows.push([{ label: 'Employee', value: `${employee.givenName} ${employee.familyName}` }])

          return (
            <>
              <Text style={SECTION_TITLE}>Basic Information</Text>
              {basicRows.map((cells, i) => (
                <DetailRow key={i} cells={cells} last={i === basicRows.length - 1} />
              ))}

              <Text style={{ ...SECTION_TITLE, marginTop: 24 }}>Additional Information</Text>
              {additionalRows.map((cells, i) => (
                <DetailRow key={i} cells={cells} last={i === additionalRows.length - 1} />
              ))}
            </>
          )
        })()}
      </Drawer>

      <Modal
        open={!!action}
        onCancel={() => setAction(null)}
        title={action ? ACTION_COPY[action].title : ''}
        okText="Confirm"
        okButtonProps={{
          danger: action ? ACTION_COPY[action].okDanger : false,
          disabled: action ? ACTION_COPY[action].requireReason && !reason.trim() : false,
        }}
        onOk={confirm}
      >
        {(action === 'reject' || action === 'cancel') && (
          <div>
            <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>
              {action === 'reject' && <span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>}
              Reason for {action === 'reject' ? 'Rejection' : 'Cancellation'}
            </Text>
            <Input.TextArea rows={3} maxLength={120} showCount value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        {action === 'approve' && <Text style={{ fontSize: 13 }}>The days move from pending approval into used.</Text>}
      </Modal>
    </>
  )
}
