// MOVE-3609 (Manage Roster Drawer) + MOVE-3705 (Delete Roster Rule).
//
// Ended rules are deliberately absent from both tabs: MOVE-3609 §3 keeps them
// in the backend for history but hides them here.

import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Drawer, Empty, Modal, Tabs, Tag, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import {
  OPERATIONS_EMPLOYEES,
  ROSTER_RULES,
  deleteRosterRule,
  upsertRosterRule,
  type RosterRule,
} from './rosterData'
import { SHIFT_LABEL, ruleBucket, type RuleBucket } from './rosterStatusLogic'
import RosterRuleModal from './RosterRuleModal'

const { Text } = Typography

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SHIFT_STYLE = {
  AM: { bg: '#e6f4ff', fg: '#0958d9' },
  PM: { bg: '#f6ffed', fg: '#389e0d' },
  OFF: { bg: '#f5f5f5', fg: '#8c8c8c' },
} as const

function formatEffective(rule: RosterRule): string {
  const start = dayjs(rule.effectiveDate).format('D MMM YYYY')
  return rule.endDate ? `${start} – ${dayjs(rule.endDate).format('D MMM YYYY')}` : `${start} – Ongoing`
}

function employeeNames(ids: string[]): string {
  if (ids.length === 0) return 'No employees assigned'
  return ids
    .map((id) => OPERATIONS_EMPLOYEES.find((e) => e.id === id)?.name ?? id)
    .sort((a, b) => a.localeCompare(b))
    .join(', ')
}

function RuleCard({
  rule,
  bucket,
  onEdit,
  onDelete,
}: {
  rule: RosterRule
  bucket: RuleBucket
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <Text strong style={{ fontSize: 13 }}>Effective: {formatEffective(rule)}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {rule.patterns.length} pattern{rule.patterns.length === 1 ? '' : 's'} · Repeat every {rule.repeatEveryWeeks} week(s)
            </Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {/* MOVE-3609 §4 — Edit on every card; Delete only on Upcoming cards. */}
          <Button size="small" icon={<EditOutlined />} onClick={onEdit}>Edit</Button>
          {bucket === 'Upcoming' && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={onDelete}>Delete</Button>
          )}
        </div>
      </div>

      {rule.patterns.map((pattern, index) => (
        <div key={pattern.id} style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #fafafa' }}>
          <Text style={{ fontSize: 12, color: '#595959' }}>
            Pattern {index + 1} · Repeat every {rule.repeatEveryWeeks} week(s)
          </Text>

          {pattern.weeks.map((week, weekIndex) => (
            <div key={weekIndex} style={{ marginTop: 8 }}>
              {pattern.weeks.length > 1 && (
                <Text type="secondary" style={{ fontSize: 10 }}>Week {weekIndex + 1}</Text>
              )}
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                {week.days.map((shift, dayIndex) => {
                  const style = SHIFT_STYLE[shift]
                  return (
                    <div
                      key={dayIndex}
                      title={SHIFT_LABEL[shift]}
                      style={{
                        width: 44,
                        borderRadius: 5,
                        padding: '4px 0',
                        textAlign: 'center',
                        background: style.bg,
                      }}
                    >
                      <div style={{ fontSize: 9, color: '#8c8c8c' }}>{DAY_LABELS[dayIndex]}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: style.fg }}>
                        {shift === 'OFF' ? 'Off' : shift}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 4 }}>
                <Tag
                  color={week.standby ? 'gold' : undefined}
                  style={{ fontSize: 10, margin: 0 }}
                >
                  {week.standby ? 'Standby for this week' : 'No standby'}
                </Tag>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Assigned Employees: </Text>
            <Text style={{ fontSize: 11, color: pattern.employeeIds.length ? '#1a1a1a' : '#bfbfbf' }}>
              {employeeNames(pattern.employeeIds)}
            </Text>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ManageRosterDrawer({
  open,
  onClose,
  onRulesChanged,
}: {
  open: boolean
  onClose: () => void
  onRulesChanged: () => void
}) {
  const today = useMemo(() => dayjs().startOf('day'), [])
  const [tab, setTab] = useState<'Current' | 'Upcoming'>('Current')
  const [modal, setModal] = useState<{ open: boolean; rule?: RosterRule; locked?: boolean }>({ open: false })
  const [revision, setRevision] = useState(0)

  const byBucket = useMemo(() => {
    void revision
    const buckets: Record<'Current' | 'Upcoming', RosterRule[]> = { Current: [], Upcoming: [] }
    for (const rule of ROSTER_RULES) {
      const bucket = ruleBucket(rule, today)
      if (bucket !== 'Ended') buckets[bucket].push(rule)
    }
    return buckets
  }, [today, revision, open])

  const refresh = () => {
    setRevision((r) => r + 1)
    onRulesChanged()
  }

  const handleDelete = (rule: RosterRule) => {
    Modal.confirm({
      title: 'Delete this roster rule?',
      icon: <ExclamationCircleFilled style={{ color: '#cf1322' }} />,
      content: `The rule effective ${formatEffective(rule)} will be removed from the roster calendar and can no longer be viewed in Manage Roster. This cannot be undone.`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: () => {
        deleteRosterRule(rule.id)
        refresh()
        message.success('Roster rule deleted.')
      },
    })
  }

  const handleSave = (rule: RosterRule) => {
    const creating = !modal.rule
    upsertRosterRule(rule)
    setModal({ open: false })
    refresh()
    message.success(creating ? 'Roster rule created.' : 'Roster rule saved.')
    // MOVE-3610 §3 — the rule lands in the tab its Effective Date implies.
    setTab(ruleBucket(rule, today) === 'Upcoming' ? 'Upcoming' : 'Current')
  }

  const renderList = (bucket: 'Current' | 'Upcoming') => {
    const rules = byBucket[bucket]
    if (rules.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            bucket === 'Current'
              ? 'No roster rule is currently in effect. Add a rule to start scheduling shifts.'
              : 'No upcoming roster rules. Add a rule to schedule a future roster.'
          }
        />
      )
    }
    return rules.map((rule) => (
      <RuleCard
        key={rule.id}
        rule={rule}
        bucket={bucket}
        onEdit={() => setModal({ open: true, rule, locked: bucket === 'Current' })}
        onDelete={() => handleDelete(rule)}
      />
    ))
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="Manage Roster"
        width={640}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true })}>
            Add Rule
          </Button>
        }
      >
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'Current' | 'Upcoming')}
          items={[
            { key: 'Current', label: `Current (${byBucket.Current.length})`, children: renderList('Current') },
            { key: 'Upcoming', label: `Upcoming (${byBucket.Upcoming.length})`, children: renderList('Upcoming') },
          ]}
        />
      </Drawer>

      <RosterRuleModal
        open={modal.open}
        rule={modal.rule}
        lockedToEndDateOnly={modal.locked}
        onCancel={() => setModal({ open: false })}
        onSave={handleSave}
      />
    </>
  )
}
