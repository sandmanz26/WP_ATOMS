// Personal Dashboard (epic MOVE-3412) — Claims drawers.
//
// Same isolation rule as the Leave drawers next to this file: fresh AntD UI,
// no shared component with `personaldashboard/PersonalDashboardLeaveTab.tsx`
// or any other page. Business rules come from `claims/claimsData.ts` and
// `claims/claimsLogic.ts` only.
//
//   MOVE-3776  Create Claims Submission (Drawer)
//   MOVE-3945  Approve/Reject Submitted Claims (For Approvers)
//   MOVE-3958  Cancel Claims Submission
//   MOVE-3964  Claims Submission Details Drawer

import { useEffect, useState } from 'react'
import {
  Button, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal, Select, Space, Tag, TimePicker, Tooltip, Typography, Upload, message,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { PaperClipOutlined, UploadOutlined } from '@ant-design/icons'
import type { LeaveEmployee } from '../leave/leaveData'
import { CURRENT_USER } from '../leave/leaveData'
import {
  CLAIM_BUS_FLEET,
  CLAIM_CATEGORIES,
  CLAIM_SUBMISSIONS,
  claimTypeLabel,
  formatAmount,
  nextClaimId,
  CLAIM_ROUTES,
  type ClaimCategory,
  type ClaimStatus,
  type ClaimSubmission,
} from '../claims/claimsData'
import {
  claimApproverOf,
  composeClaimRemarks,
  disabledReceiptTime,
  isSelectableReceiptDate,
  requiresBusNumber,
  requiresReceiptFields,
  requiresRoute,
} from '../claims/claimsLogic'

const { Text } = Typography

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

export const CLAIM_STATUS_TAG_COLOR: Record<ClaimStatus, string> = {
  'Pending Approval': 'gold',
  Approved: 'green',
  Rejected: 'red',
  Paid: 'blue',
  Cancelled: 'default',
}

export function ClaimStatusTag({ status }: { status: ClaimStatus }) {
  return <Tag color={CLAIM_STATUS_TAG_COLOR[status]}>{status}</Tag>
}

// ---------------------------------------------------------------------------
// MOVE-3776 — Create Claims Submission
// ---------------------------------------------------------------------------

interface ClaimFormValues {
  category: ClaimCategory
  otherLabel?: string
  receiptDate?: Dayjs
  receiptTime?: Dayjs
  amount: number
  busNumber?: string
  route?: string
  remarks?: string
}

export function CreateClaimDrawer({
  open,
  employee,
  onClose,
  onCreated,
}: {
  open: boolean
  employee: LeaveEmployee
  onClose: () => void
  onCreated: (message: string) => void
}) {
  const [form] = Form.useForm<ClaimFormValues>()
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const category = Form.useWatch('category', form)
  const receiptDate = Form.useWatch('receiptDate', form)
  const showReceiptFields = category ? requiresReceiptFields(category) : false
  const showBusNumber = category ? requiresBusNumber(category) : false
  const showRoute = category ? requiresRoute(category) : false

  useEffect(() => {
    if (!open) {
      form.resetFields()
      setFileName(null)
      setFileError(null)
    }
  }, [open, form])

  const submit = async () => {
    let values: ClaimFormValues
    try {
      values = await form.validateFields()
    } catch {
      // Create Leave Type pattern (FIGMA_DESIGN_SYSTEM.md §3.4) — an invalid
      // submit gets a toast, not just AntD's own silent field-scroll.
      message.error('Unable to submit claim — please fill in all required fields')
      return
    }
    if (!fileName) {
      setFileError('A supporting attachment is required.')
      message.error('Unable to submit claim — a supporting attachment is required')
      return
    }
    const remarks = composeClaimRemarks(values.category, values.remarks, values.busNumber, values.route)
    const approver = claimApproverOf(employee)
    // MOVE-3776 biz req 4 — same "no approver on file → created already
    // approved" exception as Leave's MOVE-3956.
    const status: ClaimStatus = approver ? 'Pending Approval' : 'Approved'
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    CLAIM_SUBMISSIONS.unshift({
      id: nextClaimId(),
      employeeId: employee.id,
      category: values.category,
      otherLabel: values.category === 'Others' ? values.otherLabel : undefined,
      receiptDate: showReceiptFields ? values.receiptDate?.format('YYYY-MM-DD') : undefined,
      receiptTime: showReceiptFields ? values.receiptTime?.format('HH:mm') : undefined,
      amount: values.amount,
      busNumber: showBusNumber ? values.busNumber : undefined,
      route: showRoute ? values.route : undefined,
      remarks,
      attachmentName: fileName,
      status,
      appliedOn: now,
      appliedBy: CURRENT_USER,
      approvedOn: status === 'Approved' ? now : undefined,
      approvedBy: status === 'Approved' ? 'System (no approver assigned)' : undefined,
      lastUpdatedOn: now,
    })
    onCreated(`Claim ${status === 'Approved' ? 'submitted and approved' : 'sent for approval'}.`)
  }

  return (
    <Drawer
      title="Submit Claim"
      open={open}
      onClose={onClose}
      width={480}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={submit}>Send for Approval</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ amount: 0 }}>
        <Form.Item name="category" label="Claims Type" rules={[{ required: true, message: 'Select a claims type.' }]}>
          <Select
            placeholder="Select claims type"
            options={CLAIM_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </Form.Item>

        {category === 'Others' && (
          <Form.Item
            name="otherLabel"
            label="Specify Claims Type"
            rules={[{ required: true, message: 'Enter a claims type.' }]}
          >
            <Input maxLength={80} placeholder="e.g. Conference registration fee" />
          </Form.Item>
        )}

        {showReceiptFields && (
          // Create Leave Type pattern (FIGMA_DESIGN_SYSTEM.md §3.4) — a paired
          // row of two related fields splits the row evenly (grid, 16px gap),
          // not a <Space> that leaves each control at its own intrinsic width.
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="receiptDate"
              label="Receipt Date"
              rules={[{ required: true, message: 'Select the receipt date.' }]}
            >
              <DatePicker style={{ width: '100%' }} disabledDate={isSelectableReceiptDate} />
            </Form.Item>
            <Form.Item
              name="receiptTime"
              label="Receipt Time"
              rules={[{ required: true, message: 'Select the receipt time.' }]}
            >
              <TimePicker style={{ width: '100%' }} format="h:mm A" minuteStep={5} {...disabledReceiptTime(receiptDate)} />
            </Form.Item>
          </div>
        )}

        <Form.Item
          name="amount"
          label="Amount ($)"
          rules={[{ required: true, message: 'Enter the claim amount.' }]}
        >
          <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} step={0.5} />
        </Form.Item>

        {showBusNumber && (
          <Form.Item
            name="busNumber"
            label="Bus Number"
            rules={[{ required: true, message: 'Select a bus number.' }]}
          >
            <Select
              placeholder="Select bus number"
              showSearch
              options={CLAIM_BUS_FLEET.map((b) => ({ value: b, label: b }))}
            />
          </Form.Item>
        )}

        {showRoute && (
          <Form.Item name="route" label="Route" rules={[{ required: true, message: 'Select a route.' }]}>
            <Select placeholder="Select route" options={CLAIM_ROUTES.map((r) => ({ value: r, label: r }))} />
          </Form.Item>
        )}

        <Form.Item name="remarks" label="Remarks">
          <Input.TextArea rows={3} maxLength={240} showCount />
        </Form.Item>

        <Form.Item label="Attachments">
          <Upload
            maxCount={1}
            accept=".pdf,.jpg,.jpeg,.png"
            beforeUpload={(file) => {
              if (file.size > MAX_ATTACHMENT_BYTES) {
                setFileError('File exceeds the 2MB limit.')
                return Upload.LIST_IGNORE
              }
              setFileError(null)
              setFileName(file.name)
              return false
            }}
            onRemove={() => setFileName(null)}
            fileList={fileName ? [{ uid: '1', name: fileName, status: 'done' as const }] : []}
          >
            <Button icon={<UploadOutlined />}>Select file</Button>
          </Upload>
          {fileError && (
            <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>{fileError}</Text>
          )}
        </Form.Item>
      </Form>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// MOVE-3964 — Claims Submission Details Drawer, with MOVE-3958 / MOVE-3945
// ---------------------------------------------------------------------------

type Action = 'approve' | 'reject' | 'cancel'

export function ClaimDetailsDrawer({
  claim,
  employee,
  /** True when opened from "Pending My Approval" — enables Approve/Reject. */
  canDecide,
  onClose,
  onChanged,
}: {
  claim: ClaimSubmission | null
  employee: LeaveEmployee
  canDecide: boolean
  onClose: () => void
  onChanged: (message: string) => void
}) {
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')

  if (!claim) return null
  const c = claim

  // MOVE-3958's acceptance criteria ("cancel Pending Approval and Approved")
  // is more specific than MOVE-3964's own action table (which says "pending
  // approval" only) — followed here as the authoritative source, the same
  // way MOVE-3965 overrode MOVE-3889 for Leave. Same "manage own dashboard"
  // scoping as Leave: never cancel someone else's claim from the approval
  // queue, only approve/reject it.
  const canCancel = !canDecide && (c.status === 'Pending Approval' || c.status === 'Approved')
  const canApproveReject = canDecide && c.status === 'Pending Approval'

  const openAction = (a: Action) => { setAction(a); setReason('') }

  const confirm = () => {
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    if (action === 'approve') {
      c.status = 'Approved'
      c.approvedOn = now
      c.approvedBy = CURRENT_USER
    } else if (action === 'reject') {
      c.status = 'Rejected'
      c.rejectedOn = now
      c.rejectedBy = CURRENT_USER
      c.rejectionReason = reason.trim() || undefined
    } else if (action === 'cancel') {
      c.status = 'Cancelled'
      c.cancelledOn = now
      c.cancelledBy = CURRENT_USER
      c.cancellationReason = reason.trim()
    }
    c.lastUpdatedOn = now
    setAction(null)
    onChanged(`Claim ${c.status.toLowerCase()}.`)
  }

  const ACTION_COPY: Record<Action, { title: string; okDanger: boolean; requireReason: boolean }> = {
    approve: { title: 'Approve this claim?', okDanger: false, requireReason: false },
    // MOVE-3945 does not itself require a reason (unlike MOVE-3958's explicit
    // AC for cancel) — kept optional here rather than assumed, flagged as an
    // open item for the PM.
    reject: { title: 'Reject this claim?', okDanger: true, requireReason: false },
    // MOVE-3958 AC — "requires a Reason for Cancellation... before the
    // confirm action is enabled".
    cancel: { title: 'Cancel this claim?', okDanger: true, requireReason: true },
  }

  return (
    <>
      <Drawer
        title={
          <Space>
            <span>{claimTypeLabel(c)}</span>
            <ClaimStatusTag status={c.status} />
          </Space>
        }
        open
        onClose={onClose}
        width={480}
        extra={
          <Space>
            {canCancel && <Button danger onClick={() => openAction('cancel')}>Cancel Claim</Button>}
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
          <Descriptions.Item label="Employee">{employee.givenName} {employee.familyName}</Descriptions.Item>
          <Descriptions.Item label="Department">{employee.department}</Descriptions.Item>
          <Descriptions.Item label="Receipt Date">
            {c.receiptDate ? dayjs(c.receiptDate).format('D MMM YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Receipt Time">
            {c.receiptTime ? dayjs(c.receiptTime, 'HH:mm').format('h:mm A') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Amount">{formatAmount(c.amount)}</Descriptions.Item>
          <Descriptions.Item label="Remarks">{c.remarks || '-'}</Descriptions.Item>
          <Descriptions.Item label="Attachments">
            <Tooltip title="Prototype — the file name is recorded, nothing to preview or download.">
              <Space size={4}><PaperClipOutlined />{c.attachmentName}</Space>
            </Tooltip>
          </Descriptions.Item>
        </Descriptions>

        <Text strong style={{ fontSize: 12, color: '#8c8c8c' }}>Additional Information</Text>
        <Descriptions column={1} bordered size="small" style={{ marginTop: 8 }}>
          <Descriptions.Item label="Applied On">{dayjs(c.appliedOn).format('D MMM YYYY, h:mm A')}</Descriptions.Item>
          <Descriptions.Item label="Applied By">{c.appliedBy}</Descriptions.Item>
          {c.status === 'Approved' || c.status === 'Paid' ? (
            <>
              <Descriptions.Item label="Approved On">{c.approvedOn ? dayjs(c.approvedOn).format('D MMM YYYY, h:mm A') : '-'}</Descriptions.Item>
              <Descriptions.Item label="Approved By">{c.approvedBy ?? '-'}</Descriptions.Item>
            </>
          ) : null}
          {c.status === 'Rejected' && (
            <>
              <Descriptions.Item label="Rejected On">{c.rejectedOn ? dayjs(c.rejectedOn).format('D MMM YYYY, h:mm A') : '-'}</Descriptions.Item>
              <Descriptions.Item label="Rejected By">{c.rejectedBy ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Reason for Rejection">{c.rejectionReason || '-'}</Descriptions.Item>
            </>
          )}
          {c.status === 'Cancelled' && (
            <>
              <Descriptions.Item label="Cancelled On">{c.cancelledOn ? dayjs(c.cancelledOn).format('D MMM YYYY, h:mm A') : '-'}</Descriptions.Item>
              <Descriptions.Item label="Cancelled By">{c.cancelledBy ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Reason for Cancellation">{c.cancellationReason || '-'}</Descriptions.Item>
            </>
          )}
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
              {action === 'cancel' && <span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>}
              Reason for {action === 'reject' ? 'Rejection' : 'Cancellation'}
            </Text>
            <Input.TextArea rows={3} maxLength={240} showCount value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        {action === 'approve' && <Text style={{ fontSize: 13 }}>The claim moves to Approved status.</Text>}
      </Modal>
    </>
  )
}
