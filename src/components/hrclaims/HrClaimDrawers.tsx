// Epic MOVE-4021 — everything that creates or acts on a claim from the HR
// Claims module: MOVE-3799 (submit), MOVE-3801 (details), MOVE-3920
// (approve/reject), MOVE-3731 (cancel) and MOVE-3957 (mark as paid).
//
// The actions-dropdown + confirm-modal shape follows the HR Leave drawer
// (`leave/LeaveApplicationDrawers.tsx`), which is what MOVE-3801's action
// table links to (MOVE-3779 / MOVE-3893). The details layout is the
// Basic/Additional Information two-column pattern from the Figma "Drawers
// Template" (FIGMA_DESIGN_SYSTEM.md §4.1-4.3), not the older one-column
// ReadRow list — MOVE-3801 asks for a "2 column layout for remarks", which
// only makes sense on that two-column grid.

import { useEffect, useState } from 'react'
import {
  Button, DatePicker, Divider, Drawer, Dropdown, Form, Input, InputNumber, Modal, Select, Space, Tag, TimePicker,
  Tooltip, Typography, Upload, message,
} from 'antd'
import type { UploadFile } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { DownOutlined, InboxOutlined, PaperClipOutlined } from '@ant-design/icons'
import {
  CURRENT_USER,
  HR_CLAIMS,
  HR_CLAIM_TYPES,
  SYSTEM_NO_APPROVER,
  employeeDepartment,
  employeeName,
  formatClaimAmount,
  fullName,
  hrEmployeeById,
  nextClaimNo,
  nextHrClaimId,
  remarksLines,
  requiresTrip,
  requiresVehiclePlate,
  hrClaimTypeLabel,
  type HrClaim,
  type HrClaimAttachment,
  type HrClaimStatus,
  type HrClaimType,
  type LeaveEmployee,
} from './hrClaimsData'
import { CLAIM_BUS_FLEET } from '../claims/claimsData'
import { claimApproverOf, disabledReceiptTime, isSelectableReceiptDate } from '../claims/claimsLogic'

const { Text } = Typography

export const HR_CLAIM_STATUS_COLOR: Record<HrClaimStatus, string> = {
  'Pending Approval': 'gold',
  'Pending Payment': 'cyan',
  Paid: 'blue',
  Rejected: 'red',
  Cancelled: 'default',
}

export function HrClaimStatusTag({ status }: { status: HrClaimStatus }) {
  return <Tag color={HR_CLAIM_STATUS_COLOR[status]} style={{ margin: 0 }}>{status}</Tag>
}

const fmtDateTime = (iso?: string) => (iso ? dayjs(iso).format('D MMM YYYY, h:mm A') : '-')
const fmtDate = (iso?: string) => (iso ? dayjs(iso).format('D MMM YYYY') : '-')
const fmtTime = (hhmm?: string) => (hhmm ? dayjs(hhmm, 'HH:mm').format('h:mm A') : '-')

// ---------------------------------------------------------------------------
// Detail layout — Basic/Additional Information pattern
// ---------------------------------------------------------------------------

const SECTION_TITLE: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 16, display: 'block' }
const LBL: React.CSSProperties = { fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 3 }
const VAL: React.CSSProperties = { fontSize: 13, display: 'block', fontWeight: 600, color: '#1a1a1a' }
const SUB: React.CSSProperties = { fontSize: 12, display: 'block', color: '#8c8c8c', marginTop: 2 }

type DetailCell = { label: string; value: React.ReactNode; sub?: React.ReactNode; full?: boolean }

/** 1 or 2 cells per row; `full` spans both columns (MOVE-3801's Remarks). */
function DetailRow({ cells, last }: { cells: DetailCell[]; last?: boolean }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px', padding: '0 0 16px' }}>
        {cells.map((c) => (
          <div key={c.label} style={c.full ? { gridColumn: '1 / -1' } : undefined}>
            <Text style={LBL}>{c.label}</Text>
            <Text style={VAL}>{c.value}</Text>
            {c.sub !== undefined && <Text style={SUB}>{c.sub}</Text>}
          </div>
        ))}
      </div>
      {!last && <Divider style={{ margin: '0 0 16px' }} />}
    </>
  )
}

function rows(list: (DetailCell[] | false)[]) {
  const kept = list.filter((r): r is DetailCell[] => !!r)
  return kept.map((cells, i) => <DetailRow key={cells[0].label} cells={cells} last={i === kept.length - 1} />)
}

// ---------------------------------------------------------------------------
// MOVE-3799 — Submit Claim
// ---------------------------------------------------------------------------

const ACCEPTED_EXT = ['png', 'jpg', 'jpeg', 'pdf']
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

interface SubmitValues {
  employeeId: string
  type: HrClaimType
  otherLabel?: string
  receiptDate: Dayjs
  receiptTime?: Dayjs
  amount: number
  vehiclePlate?: string
  trip?: string
  remarks?: string
}

export function SubmitHrClaimDrawer({
  open,
  employees,
  onClose,
  onSubmitted,
}: {
  open: boolean
  employees: LeaveEmployee[]
  onClose: () => void
  onSubmitted: (msg: string) => void
}) {
  const [form] = Form.useForm<SubmitValues>()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [filesTouched, setFilesTouched] = useState(false)

  const type = Form.useWatch('type', form)
  const receiptDate = Form.useWatch('receiptDate', form)
  const showPlate = requiresVehiclePlate(type)
  const showTrip = requiresTrip(type)

  useEffect(() => {
    if (!open) {
      // Biz req 3 — cancelling (or closing) saves nothing.
      form.resetFields()
      setFiles([])
      setFilesTouched(false)
    }
  }, [open, form])

  const submit = async () => {
    setFilesTouched(true)
    let values: SubmitValues
    try {
      values = await form.validateFields()
    } catch {
      message.error('Unable to submit claim — please fill in all required fields.')
      return
    }
    if (files.length === 0) {
      message.error('Unable to submit claim — please fill in all required fields.')
      return
    }
    const employee = hrEmployeeById(values.employeeId)!
    const now = dayjs()
    const nowIso = now.format('YYYY-MM-DDTHH:mm:ss')
    // Biz req 3 — no claims approver on file → created straight into Pending Payment.
    const noApprover = !claimApproverOf(employee)
    const claimNo = nextClaimNo(now)
    const attachments: HrClaimAttachment[] = files.map((f) => ({
      name: f.name,
      url: f.originFileObj ? URL.createObjectURL(f.originFileObj) : undefined,
    }))
    HR_CLAIMS.unshift({
      id: nextHrClaimId(),
      claimNo,
      employeeId: employee.id,
      type: values.type,
      otherLabel: values.type === 'Others' ? values.otherLabel?.trim() : undefined,
      receiptDate: values.receiptDate.format('YYYY-MM-DD'),
      receiptTime: values.receiptTime?.format('HH:mm'),
      amount: values.amount,
      vehiclePlate: requiresVehiclePlate(values.type) ? values.vehiclePlate : undefined,
      trip: requiresTrip(values.type) ? values.trip?.trim() : undefined,
      remarks: values.remarks?.trim() || undefined,
      attachments,
      status: noApprover ? 'Pending Payment' : 'Pending Approval',
      createdOn: nowIso,
      createdBy: CURRENT_USER,
      approvedOn: noApprover ? nowIso : undefined,
      approvedBy: noApprover ? SYSTEM_NO_APPROVER : undefined,
      lastUpdatedOn: nowIso,
    })
    onSubmitted(
      noApprover
        ? `Claim ${claimNo} submitted — moved straight to Pending Payment, as ${fullName(employee)} has no claims approver.`
        : `Claim ${claimNo} sent for approval.`,
    )
  }

  const filesMissing = filesTouched && files.length === 0

  return (
    <Drawer
      title="Submit Claim"
      open={open}
      onClose={onClose}
      width={520}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={submit}>Send for Approval</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" requiredMark initialValues={{ amount: 0 }}>
        <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Select an employee.' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select employee"
            options={employees.map((e) => ({ value: e.id, label: fullName(e) }))}
          />
        </Form.Item>

        <Form.Item name="type" label="Claim Type" rules={[{ required: true, message: 'Select a claim type.' }]}>
          <Select placeholder="Select claim type" options={HR_CLAIM_TYPES.map((t) => ({ value: t, label: t }))} />
        </Form.Item>

        {type === 'Others' && (
          <Form.Item
            name="otherLabel"
            label="Specify Claim Type"
            rules={[{ required: true, whitespace: true, message: 'Enter the claim type.' }]}
          >
            <Input placeholder="e.g. air freshener" />
          </Form.Item>
        )}

        {/* FIGMA_DESIGN_SYSTEM.md §3.4 — a related pair shares a row, 16px gap. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="receiptDate" label="Receipt Date" rules={[{ required: true, message: 'Select the receipt date.' }]}>
            <DatePicker
              style={{ width: '100%' }}
              format="D MMM YYYY"
              disabledDate={isSelectableReceiptDate}
              onChange={() => form.validateFields(['receiptTime']).catch(() => undefined)}
            />
          </Form.Item>
          <Form.Item
            name="receiptTime"
            label="Receipt Time"
            dependencies={['receiptDate']}
            rules={[
              {
                // Biz req 2 — on today's date, only a time already past.
                validator: (_, v: Dayjs | undefined) => {
                  const d = form.getFieldValue('receiptDate') as Dayjs | undefined
                  if (!v || !d || !d.isSame(dayjs(), 'day')) return Promise.resolve()
                  const asToday = dayjs().hour(v.hour()).minute(v.minute())
                  return asToday.isAfter(dayjs(), 'minute')
                    ? Promise.reject(new Error('Receipt time cannot be in the future.'))
                    : Promise.resolve()
                },
              },
            ]}
          >
            <TimePicker style={{ width: '100%' }} format="h:mm A" use12Hours minuteStep={5} {...disabledReceiptTime(receiptDate)} />
          </Form.Item>
        </div>

        <Form.Item
          name="amount"
          label="Amount"
          rules={[
            { required: true, message: 'Enter the claim amount.' },
            {
              validator: (_, v: number | null) =>
                v && v > 0 ? Promise.resolve() : Promise.reject(new Error('Enter an amount greater than $0.00.')),
            },
          ]}
        >
          <InputNumber<number> style={{ width: '100%' }} prefix="$" min={0} precision={2} step={0.5} />
        </Form.Item>

        {(showPlate || showTrip) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {showPlate && (
              <Form.Item
                name="vehiclePlate"
                label="Vehicle Licence Plate"
                rules={[{ required: true, message: 'Select a vehicle licence plate.' }]}
              >
                <Select
                  showSearch
                  placeholder="Select vehicle"
                  options={CLAIM_BUS_FLEET.map((p) => ({ value: p, label: p }))}
                />
              </Form.Item>
            )}
            {showTrip && (
              <Form.Item name="trip" label="Trip" rules={[{ required: true, whitespace: true, message: 'Enter the trip.' }]}>
                <Input maxLength={120} placeholder="e.g. WP 1 (3:00 PM)" />
              </Form.Item>
            )}
          </div>
        )}

        <Form.Item name="remarks" label="Remarks">
          <Input.TextArea rows={3} maxLength={240} showCount placeholder="Optional" />
        </Form.Item>

        <Form.Item
          label="Attachments"
          required
          validateStatus={filesMissing ? 'error' : undefined}
          help={filesMissing ? 'Upload at least one attachment.' : 'PNG, JPG/JPEG or PDF, up to 2MB each. More than one file is allowed.'}
        >
          <Upload.Dragger
            multiple
            accept=".png,.jpg,.jpeg,.pdf"
            fileList={files}
            beforeUpload={(file) => {
              const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
              if (!ACCEPTED_EXT.includes(ext)) {
                message.error(`${file.name} is not a supported file type — upload PNG, JPG/JPEG or PDF.`)
                return Upload.LIST_IGNORE
              }
              if (file.size > MAX_ATTACHMENT_BYTES) {
                message.error(`${file.name} is larger than 2MB.`)
                return Upload.LIST_IGNORE
              }
              // No backend: keep the file in memory only.
              return false
            }}
            onChange={({ fileList }) => setFiles(fileList.map((f) => ({ ...f, status: 'done' as const })))}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Click or drag files to this area to upload</p>
          </Upload.Dragger>
        </Form.Item>
      </Form>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// MOVE-3801 — Claim Details, with MOVE-3920 / MOVE-3731 / MOVE-3957 actions
// ---------------------------------------------------------------------------

type ClaimAction = 'approve' | 'reject' | 'cancel' | 'paid'

const CONFIRM_COPY: Record<'approve' | 'reject' | 'cancel', { title: string; body: string; danger: boolean }> = {
  approve: {
    title: 'Approve claim?',
    body: 'The claim moves to Pending Payment, ready to be paid out.',
    danger: false,
  },
  reject: {
    title: 'Reject claim?',
    body: 'A rejected claim cannot be cancelled or reopened afterwards.',
    danger: true,
  },
  cancel: {
    title: 'Cancel claim?',
    body: 'The claim stays on record as cancelled and can no longer be approved.',
    danger: true,
  },
}

function AttachmentLinks({ items }: { items: HrClaimAttachment[] }) {
  if (items.length === 0) return <>-</>
  // Biz req 1 — file names separated by ",", each clickable to preview/download.
  return (
    <span style={{ fontWeight: 600 }}>
      {items.map((a, i) => (
        <span key={a.name + i}>
          {i > 0 && ', '}
          {a.url ? (
            <a href={a.url} target="_blank" rel="noreferrer" download={a.name}>
              <PaperClipOutlined style={{ marginRight: 3 }} />
              {a.name}
            </a>
          ) : (
            <Tooltip title="Sample record — no file is stored in this prototype.">
              <span style={{ color: '#1677ff', cursor: 'help' }}>
                <PaperClipOutlined style={{ marginRight: 3 }} />
                {a.name}
              </span>
            </Tooltip>
          )}
        </span>
      ))}
    </span>
  )
}

export function HrClaimDetailsDrawer({
  claim,
  onClose,
  onChanged,
}: {
  claim: HrClaim | null
  onClose: () => void
  onChanged: (msg: string) => void
}) {
  const [action, setAction] = useState<ClaimAction | null>(null)
  const [reason, setReason] = useState('')
  const [payForm] = Form.useForm<{ paymentDate: Dayjs; paymentRefNo: string }>()

  if (!claim) return null
  const c = claim

  const isPendingApproval = c.status === 'Pending Approval'
  const isPendingPayment = c.status === 'Pending Payment'
  const statusWord = c.status.toLowerCase()

  const closeModal = () => {
    setAction(null)
    setReason('')
    payForm.resetFields()
  }

  const confirm = (a: 'approve' | 'reject' | 'cancel') => {
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    if (a === 'approve') {
      // MOVE-3920 — approving moves the claim to Pending Payment, not "Approved".
      c.status = 'Pending Payment'
      c.approvedOn = now
      c.approvedBy = CURRENT_USER
    } else if (a === 'reject') {
      c.status = 'Rejected'
      c.rejectedOn = now
      c.rejectedBy = CURRENT_USER
      c.rejectionReason = reason.trim()
    } else {
      c.status = 'Cancelled'
      c.cancelledOn = now
      c.cancelledBy = CURRENT_USER
      c.cancellationReason = reason.trim()
    }
    c.lastUpdatedOn = now
    closeModal()
    const verb = a === 'approve' ? 'approved' : a === 'reject' ? 'rejected' : 'cancelled'
    onChanged(`Claim ${c.claimNo} ${verb}.`)
    // MOVE-3731 — cancelling closes the drawer too; approve/reject stay on it (MOVE-3920).
    if (a === 'cancel') onClose()
  }

  const savePaid = async () => {
    let v: { paymentDate: Dayjs; paymentRefNo: string }
    try {
      v = await payForm.validateFields()
    } catch {
      message.error('Unable to mark claim as paid — please fill in all required fields.')
      return
    }
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    c.status = 'Paid'
    c.paymentDate = v.paymentDate.format('YYYY-MM-DD')
    c.paymentRefNo = v.paymentRefNo.trim()
    c.lastUpdatedOn = now
    closeModal()
    onChanged(`Claim ${c.claimNo} marked as paid.`)
  }

  /**
   * Every action is disabled *with a tooltip* when the status doesn't allow it
   * (MOVE-3920 / MOVE-3731 / MOVE-3957 biz req 1). AntD fires no hover events
   * on a disabled menu item, so the tooltip wraps the label instead.
   */
  const item = (key: ClaimAction, label: string, allowed: boolean, why: string, danger = false) => ({
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

  const menuItems = [
    item('approve', 'Approve', isPendingApproval, `Only a claim pending approval can be approved — this one is ${statusWord}.`),
    item('reject', 'Reject', isPendingApproval, `Only a claim pending approval can be rejected — this one is ${statusWord}.`),
    item('paid', 'Mark as Paid', isPendingPayment, `Only a claim pending payment can be marked as paid — this one is ${statusWord}.`),
    item('cancel', 'Cancel', isPendingApproval, `Only a claim pending approval can be cancelled — this one is ${statusWord}.`, true),
  ]

  const lines = remarksLines(c)
  const wasApproved = c.status === 'Pending Payment' || c.status === 'Paid'
  const confirmAction = action === 'approve' || action === 'reject' || action === 'cancel' ? action : null
  const needsReason = action === 'reject' || action === 'cancel'

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width={560}
        title={
          <Space>
            <span>{c.claimNo}</span>
            <HrClaimStatusTag status={c.status} />
          </Space>
        }
        // Biz req 2 — no primary CTA; every action sits under the dropdown.
        extra={
          <Dropdown
            trigger={['click']}
            menu={{ items: menuItems, onClick: ({ key }) => { setAction(key as ClaimAction); setReason('') } }}
          >
            <Button>
              Actions <DownOutlined />
            </Button>
          </Dropdown>
        }
      >
        <Text style={SECTION_TITLE}>Basic Information</Text>
        {rows([
          [
            { label: 'Employee', value: employeeName(c.employeeId), sub: employeeDepartment(c.employeeId) },
            { label: 'Claim Type', value: hrClaimTypeLabel(c) },
          ],
          [
            { label: 'Submission Date', value: fmtDate(c.createdOn) },
            { label: 'Receipt Date & Time', value: fmtDate(c.receiptDate), sub: fmtTime(c.receiptTime) },
          ],
          [
            { label: 'Amount', value: formatClaimAmount(c.amount) },
            { label: 'Attachments', value: <AttachmentLinks items={c.attachments} /> },
          ],
          [
            { label: 'Vehicle Licence Plate', value: c.vehiclePlate ?? '-' },
            { label: 'Trip', value: c.trip ?? '-' },
          ],
          [
            {
              label: 'Remarks',
              full: true,
              value: lines.length ? <span style={{ whiteSpace: 'pre-line' }}>{lines.join('\n')}</span> : '-',
            },
          ],
        ])}

        {/* Biz req 1 — Payment Information shows only once the claim is paid. */}
        {c.status === 'Paid' && (
          <>
            <Text style={{ ...SECTION_TITLE, marginTop: 24 }}>Payment Information</Text>
            {rows([
              [
                { label: 'Payment Date', value: fmtDate(c.paymentDate) },
                { label: 'Payment Reference No.', value: c.paymentRefNo ?? '-' },
              ],
            ])}
          </>
        )}

        <Text style={{ ...SECTION_TITLE, marginTop: 24 }}>Additional Information</Text>
        {rows([
          [
            { label: 'Created On', value: fmtDateTime(c.createdOn) },
            { label: 'Created By', value: c.createdBy },
          ],
          wasApproved && [
            { label: 'Approved On', value: fmtDateTime(c.approvedOn) },
            { label: 'Approved By', value: c.approvedBy ?? '-' },
          ],
          c.status === 'Rejected' && [
            { label: 'Rejected On', value: fmtDateTime(c.rejectedOn) },
            { label: 'Rejected By', value: c.rejectedBy ?? '-' },
          ],
          c.status === 'Rejected' && [{ label: 'Reason for Rejection', value: c.rejectionReason || '-', full: true }],
          c.status === 'Cancelled' && [
            { label: 'Cancelled On', value: fmtDateTime(c.cancelledOn) },
            { label: 'Cancelled By', value: c.cancelledBy ?? '-' },
          ],
          c.status === 'Cancelled' && [{ label: 'Reason for Cancellation', value: c.cancellationReason || '-', full: true }],
        ])}
      </Drawer>

      {/* MOVE-3920 approve/reject, MOVE-3731 cancel. Cancel / X / outside
          click all just close the modal and leave the status untouched. */}
      <Modal
        open={!!confirmAction}
        onCancel={closeModal}
        title={confirmAction ? CONFIRM_COPY[confirmAction].title : ''}
        okText="Confirm"
        cancelText="Cancel"
        okButtonProps={{
          danger: confirmAction ? CONFIRM_COPY[confirmAction].danger : false,
          // Both reasons are required (MOVE-3920 reject, MOVE-3731 cancel).
          disabled: needsReason && !reason.trim(),
        }}
        onOk={() => confirmAction && confirm(confirmAction)}
      >
        <Text style={{ fontSize: 13 }}>{confirmAction ? CONFIRM_COPY[confirmAction].body : ''}</Text>
        {needsReason && (
          <div style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>
              <span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>
              Reason for {action === 'reject' ? 'Rejection' : 'Cancellation'}
            </Text>
            <Input.TextArea rows={3} maxLength={120} showCount value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
      </Modal>

      {/* MOVE-3957 — Mark as Paid. */}
      <Modal
        open={action === 'paid'}
        onCancel={closeModal}
        title="Mark Claim as Paid"
        okText="Save"
        cancelText="Cancel"
        onOk={savePaid}
        destroyOnHidden
      >
        <Form form={payForm} layout="vertical" requiredMark style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true, message: 'Select the payment date.' }]}>
              <DatePicker style={{ width: '100%' }} format="D MMM YYYY" disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
            </Form.Item>
            <Form.Item
              name="paymentRefNo"
              label="Payment Reference No."
              rules={[{ required: true, whitespace: true, message: 'Enter the payment reference no.' }]}
            >
              <Input maxLength={50} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  )
}
