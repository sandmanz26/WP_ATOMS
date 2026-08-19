// MOVE-3609 (Manage Shift Patterns drawer) + MOVE-3705 (Delete).
//
// Ended rules are deliberately absent from both tabs: MOVE-3609 §3 keeps them
// in the backend for history but hides them here.
//
// The 18 Aug review reshaped the card: instead of listing each pattern's weekly
// grid and its assigned employees, it shows a headcount per shift per day, with
// standby summarised per person underneath. A rule now covers the whole team,
// so naming every employee in every cell would not fit and would not be read.

import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Drawer, Empty, Modal, Tabs, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import {
  OPERATIONS_EMPLOYEES,
  ROSTER_RULES,
  deleteRosterRule,
  upsertRosterRule,
  type RosterRule,
  type RuleWeek,
} from './rosterData'
import { ruleBucket, type RuleBucket } from './rosterStatusLogic'
import RosterRuleModal from './RosterRuleModal'

const { Text } = Typography

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const GRID_COLUMNS = '120px repeat(7, minmax(30px, 1fr))'

function formatEffective(rule: RosterRule): string {
  const start = dayjs(rule.effectiveDate).format('D MMM YYYY')
  return rule.endDate ? `${start} – ${dayjs(rule.endDate).format('D MMM YYYY')}` : `${start} – Ongoing`
}

function employeeName(id: string): string {
  return OPERATIONS_EMPLOYEES.find((e) => e.id === id)?.name ?? id
}

/**
 * "Mon–Wed, Sat" from [0,1,2,5]. Consecutive days collapse into a range so a
 * full week reads as one span rather than seven names.
 */
export function formatDayRanges(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  const spans: string[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    spans.push(i === j ? DAY_NAMES[sorted[i]] : `${DAY_NAMES[sorted[i]]}–${DAY_NAMES[sorted[j]]}`)
    i = j + 1
  }
  return spans.join(', ')
}

/** One line per person: "Hity (Mon–Wed, Sat) | Mus (Thu–Fri)". */
function standbySummary(week: RuleWeek): string {
  const byEmployee = new Map<string, number[]>()
  week.standby.forEach((ids, day) => {
    for (const id of ids) {
      const days = byEmployee.get(id) ?? []
      days.push(day)
      byEmployee.set(id, days)
    }
  })
  if (byEmployee.size === 0) return 'No standby assigned'
  return [...byEmployee.entries()]
    .map(([id, days]) => [employeeName(id), days] as const)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, days]) => `${name} (${formatDayRanges(days)})`)
    .join('  |  ')
}

function CountRow({ label, counts }: { label: string; counts: number[] }) {
  return (
    <>
      <Text style={{ fontSize: 12 }}>{label}</Text>
      {counts.map((count, dayIndex) => (
        <Text
          key={dayIndex}
          style={{ fontSize: 12, textAlign: 'center', color: count ? '#1a1a1a' : '#d9d9d9' }}
        >
          {count || '–'}
        </Text>
      ))}
    </>
  )
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
              Repeat every {rule.repeatEveryWeeks} week(s)
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

      <div style={{ display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: '6px 4px', marginTop: 14, alignItems: 'center' }}>
        <span />
        {DAY_LABELS.map((label, dayIndex) => (
          <Text
            key={dayIndex}
            strong
            style={{ fontSize: 12, textAlign: 'center', color: dayIndex >= 5 ? '#cf1322' : '#595959' }}
          >
            {label}
          </Text>
        ))}

        {rule.weeks.flatMap((week, weekIndex) => [
          <CountRow key={`am-${weekIndex}`} label={`Week ${weekIndex + 1} - AM`} counts={week.am.map((d) => d.length)} />,
          <CountRow key={`pm-${weekIndex}`} label={`Week ${weekIndex + 1} - PM`} counts={week.pm.map((d) => d.length)} />,
        ])}
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #fafafa' }}>
        {rule.weeks.map((week, weekIndex) => (
          <div key={weekIndex} style={{ marginTop: weekIndex ? 4 : 0 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Week {weekIndex + 1} Standby: </Text>
            <Text style={{ fontSize: 11 }}>{standbySummary(week)}</Text>
          </div>
        ))}
      </div>
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
      title: 'Delete these shift patterns?',
      icon: <ExclamationCircleFilled style={{ color: '#cf1322' }} />,
      content: `The shift patterns effective ${formatEffective(rule)} will be removed from the roster calendar and can no longer be viewed here. This cannot be undone.`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: () => {
        deleteRosterRule(rule.id)
        refresh()
        message.success('Shift patterns deleted.')
      },
    })
  }

  const handleSave = (rule: RosterRule) => {
    const creating = !modal.rule
    upsertRosterRule(rule)
    setModal({ open: false })
    refresh()
    message.success(creating ? 'Shift patterns created.' : 'Shift patterns saved.')
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
              ? 'No shift patterns are currently in effect. Add shift patterns to start scheduling.'
              : 'No upcoming shift patterns. Add shift patterns to schedule a future roster.'
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
        title="Manage Shift Patterns"
        width={640}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true })}>
            Add Shift Patterns
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
