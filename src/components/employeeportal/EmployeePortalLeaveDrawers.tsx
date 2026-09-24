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
  Button, DatePicker, Descriptions, Drawer, Form, Input, Modal, Radio, Select, Space, Tag, TimePicker, Tooltip, Typography, Upload,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { PaperClipOutlined, UploadOutlined } from '@ant-design/icons'
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
  balancesFor,
  deductionFor,
  deductionInYear,
  formatDays,
  isSelectableDate,
  leaveTypeById,
  requiresDocument,
  yearsSpanned,
} from '../leave/leaveLogic'

const { Text } = Typography

const TIME_OFF_ID = 'lt-timeoff'

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
  dateRange: [Dayjs, Dayjs]
  startHalf: HalfDay
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
  const dateRange = Form.useWatch('dateRange', form)
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
    if (isTimeOff && dateRange?.[0]) {
      form.setFieldValue('dateRange', [dateRange[0], dateRange[0]])
    }
  }, [isTimeOff, dateRange, form])

  const [start, end] = dateRange ?? []
  const yearsTouched = start && end ? yearsSpanned(start.format(ISO), end.format(ISO)) : []

  const submit = async () => {
    const values = await form.validateFields()
    if (docRequired && !fileName) {
      form.setFields([{ name: 'leaveTypeId', errors: [] }])
      return
    }
    const [s, e] = values.dateRange
    const approver = employee.leaveApprover
    // MOVE-3956 — no approver on file means the application is created
    // already approved, rather than sitting pending forever.
    const status: LeaveStatus = approver ? 'Pending Approval' : 'Approved'
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    LEAVE_APPLICATIONS.unshift({
      id: nextId('la'),
      employeeId: employee.id,
      leaveTypeId: values.leaveTypeId,
      startDate: s.format(ISO),
      endDate: e.format(ISO),
      startHalf: values.startHalf,
      endHalf: values.endHalf,
      startTime: isTimeOff && values.timeRange ? values.timeRange[0].format('HH:mm') : undefined,
      endTime: isTimeOff && values.timeRange ? values.timeRange[1].format('HH:mm') : undefined,
      days: isTimeOff ? 0 : deductionFor(employee, s.format(ISO), e.format(ISO), values.startHalf, values.endHalf),
      remarks: values.remarks || undefined,
      documentName: fileName ?? undefined,
      status,
      appliedOn: now,
      appliedBy: CURRENT_USER,
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

        <Form.Item
          name="dateRange"
          label="Leave Application Period"
          rules={[{ required: true, message: 'Select the start and end date.' }]}
        >
          <DatePicker.RangePicker
            style={{ width: '100%' }}
            disabled={[false, isTimeOff]}
            disabledDate={(d) => (type ? !isSelectableDate(employee, type, d.year(), d) : false)}
          />
        </Form.Item>

        <Space size={24}>
          <Form.Item name="startHalf" label="Start" style={{ marginBottom: 0 }}>
            <Radio.Group options={[{ label: 'AM', value: 'AM' }, { label: 'PM', value: 'PM' }]} optionType="button" size="small" />
          </Form.Item>
          <Form.Item name="endHalf" label="End" style={{ marginBottom: 0 }}>
            <Radio.Group options={[{ label: 'AM', value: 'AM' }, { label: 'PM', value: 'PM' }]} optionType="button" size="small" />
          </Form.Item>
        </Space>

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

        {/* MOVE-3946 §3 — the live balance preview, one block per year the
            period touches, sliced the same way the balances table slices it. */}
        {type && start && end && (
          <div style={{ marginBottom: 20 }}>
            {yearsTouched.map((y) => {
              const inYear = isTimeOff ? 0 : deductionInYear(employee, start.format(ISO), end.format(ISO), startHalf, endHalf, y)
              return (
                <div
                  key={y}
                  style={{
                    background: '#f6f8fa', border: '1px solid #e8eaed', borderRadius: 8,
                    padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#595959' }}>{yearsTouched.length > 1 ? `Deduction (${y})` : 'Deduction'}</Text>
                  <Text strong style={{ fontSize: 12 }}>{isTimeOff ? '-' : formatDays(inYear)}</Text>
                </div>
              )
            })}
          </div>
        )}

        <Form.Item name="remarks" label="Remarks">
          <Input.TextArea rows={3} maxLength={120} showCount />
        </Form.Item>

        <Form.Item label={`Supporting Document${docRequired ? '' : ' (optional)'}`}>
          <Upload
            maxCount={1}
            accept=".pdf,.jpg,.jpeg,.png"
            beforeUpload={(file) => { setFileName(file.name); return false }}
            onRemove={() => setFileName(null)}
            fileList={fileName ? [{ uid: '1', name: fileName, status: 'done' as const }] : []}
          >
            <Button icon={<UploadOutlined />}>Select file</Button>
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
  /** True when opened from "Pending My Approval" — enables Approve/Reject. */
  canDecide,
  onClose,
  onChanged,
}: {
  application: LeaveApplication | null
  employee: LeaveEmployee
  canDecide: boolean
  onClose: () => void
  onChanged: (message: string) => void
}) {
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')

  if (!application) return null
  const app = application
  const type = leaveTypeById(app.leaveTypeId)
  const isTimeOff = app.leaveTypeId === TIME_OFF_ID

  // MOVE-3950 §"only when pending approval / approved" — and only the
  // applicant's own action. MOVE-3947 biz req 4 is explicit that "manage own
  // dashboard" means acting on one's own leave only, so an approver reviewing
  // someone else's application (canDecide) gets Approve/Reject, never Cancel.
  const canCancel = !canDecide && (app.status === 'Pending Approval' || app.status === 'Approved')
  // MOVE-3952 — approve/reject only make sense while pending, and only for
  // someone reviewing another employee's application.
  const canApproveReject = canDecide && app.status === 'Pending Approval'

  const openAction = (a: Action) => { setAction(a); setReason('') }

  const confirm = () => {
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    if (action === 'approve') {
      app.status = 'Approved'
      app.approvedOn = now
      app.approvedBy = CURRENT_USER
    } else if (action === 'reject') {
      app.status = 'Rejected'
      app.rejectedOn = now
      app.rejectedBy = CURRENT_USER
      app.rejectionReason = reason.trim()
    } else if (action === 'cancel') {
      app.status = 'Cancelled'
      app.cancelledOn = now
      app.cancelledBy = CURRENT_USER
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
        extra={
          <Space>
            {canCancel && <Button danger onClick={() => openAction('cancel')}>Cancel Leave</Button>}
            {canApproveReject && (
              <>
                <Button danger onClick={() => openAction('reject')}>Reject</Button>
                <Button type="primary" onClick={() => openAction('approve')}>Approve</Button>
              </>
            )}
          </Space>
        }
      >
        <Descriptions column={1} bordered size="small" style={{ marginBottom: 20 }}>
          <Descriptions.Item label="Dates">
            {dayjs(app.startDate).format('D MMM YYYY')} - {dayjs(app.endDate).format('D MMM YYYY')}
            {isTimeOff && app.startTime && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(app.startTime, 'HH:mm').format('h:mm A')} - {dayjs(app.endTime, 'HH:mm').format('h:mm A')}
                </Text>
              </div>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Days Used">{isTimeOff ? '-' : formatDays(app.days)}</Descriptions.Item>
          <Descriptions.Item label="Remarks">{app.remarks || '-'}</Descriptions.Item>
          <Descriptions.Item label="Supporting Document">
            {app.documentName ? (
              <Tooltip title="Prototype — the file name is recorded, nothing to download.">
                <Space size={4}><PaperClipOutlined />{app.documentName}</Space>
              </Tooltip>
            ) : '-'}
          </Descriptions.Item>
        </Descriptions>

        <Text strong style={{ fontSize: 12, color: '#8c8c8c' }}>Additional Information</Text>
        <Descriptions column={1} bordered size="small" style={{ marginTop: 8 }}>
          <Descriptions.Item label="Created On">{dayjs(app.appliedOn).format('D MMM YYYY, h:mm A')}</Descriptions.Item>
          <Descriptions.Item label="Created By">{app.appliedBy}</Descriptions.Item>
          {app.status === 'Approved' && (
            <>
              <Descriptions.Item label="Approved On">{app.approvedOn ? dayjs(app.approvedOn).format('D MMM YYYY, h:mm A') : '-'}</Descriptions.Item>
              <Descriptions.Item label="Approved By">{app.approvedBy ?? '-'}</Descriptions.Item>
            </>
          )}
          {app.status === 'Rejected' && (
            <>
              <Descriptions.Item label="Rejected On">{app.rejectedOn ? dayjs(app.rejectedOn).format('D MMM YYYY, h:mm A') : '-'}</Descriptions.Item>
              <Descriptions.Item label="Rejected By">{app.rejectedBy ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Reason for Rejection">{app.rejectionReason || '-'}</Descriptions.Item>
            </>
          )}
          {app.status === 'Cancelled' && (
            <>
              <Descriptions.Item label="Cancelled On">{app.cancelledOn ? dayjs(app.cancelledOn).format('D MMM YYYY, h:mm A') : '-'}</Descriptions.Item>
              <Descriptions.Item label="Cancelled By">{app.cancelledBy ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Reason for Cancellation">{app.cancellationReason || '-'}</Descriptions.Item>
            </>
          )}
          <Descriptions.Item label="Employee">{employee.givenName} {employee.familyName}</Descriptions.Item>
        </Descriptions>
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
