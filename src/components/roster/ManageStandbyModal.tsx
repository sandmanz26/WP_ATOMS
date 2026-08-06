// MOVE-3658 §3 — Manage Standby, opened from the "+" action beneath a day cell
// while the roster is in edit mode. Standby may only be assigned within the
// month currently being edited.

import { useEffect, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { DatePicker, Modal, Select, Typography, message } from 'antd'
import { ISO } from './rosterStatusLogic'
import type { RosterOverride } from './rosterData'

const { Text } = Typography
const { RangePicker } = DatePicker

export interface StandbyTarget {
  employeeId: string
  employeeName: string
  date: string
}

export default function ManageStandbyModal({
  open,
  target,
  editMonth,
  onCancel,
  onApply,
}: {
  open: boolean
  target: StandbyTarget | null
  editMonth: Dayjs
  onCancel: () => void
  onApply: (overrides: RosterOverride[]) => void
}) {
  const [action, setAction] = useState<'assign' | 'remove'>('assign')
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)

  useEffect(() => {
    if (!open || !target) return
    setAction('assign')
    setRange([dayjs(target.date), dayjs(target.date)])
  }, [open, target])

  const monthStart = editMonth.startOf('month')
  const monthEnd = editMonth.endOf('month')

  const handleOk = () => {
    if (!target || !range) {
      message.error('Unable to save. Select an effective date range.')
      return
    }
    const [start, end] = range
    const overrides: RosterOverride[] = []
    for (let d = start.startOf('day'); !d.isAfter(end, 'day'); d = d.add(1, 'day')) {
      overrides.push({ employeeId: target.employeeId, date: d.format(ISO), standby: action === 'assign' })
    }
    onApply(overrides)
  }

  return (
    <Modal
      open={open}
      title="Manage Standby"
      onCancel={onCancel}
      onOk={handleOk}
      okText="Save"
      width={460}
    >
      {target && (
        <>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Employee</Text>
            <div><Text strong style={{ fontSize: 13 }}>{target.employeeName}</Text></div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Action <span style={{ color: '#cf1322' }}>*</span></Text>
            </div>
            <Select
              value={action}
              onChange={setAction}
              style={{ width: '100%' }}
              options={[
                { value: 'assign', label: 'Assign Standby' },
                { value: 'remove', label: 'Remove Standby' },
              ]}
            />
          </div>

          <div>
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Effective Date <span style={{ color: '#cf1322' }}>*</span></Text>
            </div>
            <RangePicker
              value={range}
              onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
              style={{ width: '100%' }}
              format="D MMM YYYY"
              // Standby can only be assigned within the month being edited.
              disabledDate={(d) => d.isBefore(monthStart, 'day') || d.isAfter(monthEnd, 'day')}
            />
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Limited to {editMonth.format('MMMM YYYY')}, the month being edited.
              </Text>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
