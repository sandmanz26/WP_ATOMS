// MOVE-3609 (Manage Shift Patterns drawer) + MOVE-3705 (Delete).
//
// Ended rules are deliberately absent from both tabs: MOVE-3609 §3 keeps them
// in the backend for history but hides them here.
//
// The 18 Aug review reshaped the card: instead of listing each pattern's weekly
// grid and its assigned employees, it shows a headcount per shift per day, with
// standby summarised per person underneath. A rule now covers the whole team,
// so naming every employee in every cell would not fit and would not be read.

import { Fragment, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Badge, Button, Drawer, Empty, Modal, Tabs, Typography, message } from 'antd'
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
import type { PatternCardStyle } from './RosterVariantSwitcher'

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

/** Plain mode: an open grid, no rules or fills. */
function PlainCounts({ rule }: { rule: RosterRule }) {
  return (
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
      {rule.weeks.flatMap((week, weekIndex) =>
        (['am', 'pm'] as const).map((row) => (
          <Fragment key={`${row}-${weekIndex}`}>
            <Text strong style={{ fontSize: 12 }}>{`Week ${weekIndex + 1} - ${row.toUpperCase()}`}</Text>
            {week[row].map((day, dayIndex) => (
              <Text
                key={dayIndex}
                style={{ fontSize: 12, textAlign: 'center', color: day.length ? '#1a1a1a' : '#d9d9d9' }}
              >
                {day.length || '–'}
              </Text>
            ))}
          </Fragment>
        ))
      )}
    </div>
  )
}

/** Table mode: bordered cells with a shaded header, as the design sketch draws it. */
function TableCounts({ rule }: { rule: RosterRule }) {
  const cell: React.CSSProperties = {
    border: '1px solid #e8e8e8',
    padding: '6px 8px',
    fontSize: 12,
    textAlign: 'center',
  }
  const headCell: React.CSSProperties = { ...cell, background: '#fafafa', fontWeight: 600 }
  // Feedback — both axes of the table are labels, so both read bold.
  const rowLabelCell: React.CSSProperties = { ...cell, textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }

  return (
    <div style={{ overflowX: 'auto', marginTop: 14 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
        <thead>
          <tr>
            <th style={{ ...headCell, textAlign: 'left', minWidth: 120 }} />
            {DAY_LABELS.map((label, dayIndex) => (
              <th key={dayIndex} style={{ ...headCell, color: dayIndex >= 5 ? '#cf1322' : '#595959' }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rule.weeks.flatMap((week, weekIndex) =>
            (['am', 'pm'] as const).map((row) => (
              <tr key={`${row}-${weekIndex}`}>
                <td style={rowLabelCell}>{`Week ${weekIndex + 1} - ${row.toUpperCase()}`}</td>
                {week[row].map((day, dayIndex) => (
                  <td key={dayIndex} style={{ ...cell, color: day.length ? '#1a1a1a' : '#d9d9d9' }}>
                    {day.length || '–'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function RuleCard({
  rule,
  bucket,
  cardStyle,
  onEdit,
  onDelete,
}: {
  rule: RosterRule
  bucket: RuleBucket
  cardStyle: PatternCardStyle
  onEdit: () => void
  onDelete: () => void
}) {
  const table = cardStyle === 'table'
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

      {table ? <TableCounts rule={rule} /> : <PlainCounts rule={rule} />}

      {/* In table mode the standby lines are boxed to match the grid above; in
          plain mode a hairline is enough to separate them. */}
      <div
        style={
          table
            ? { marginTop: 8, border: '1px solid #e8e8e8', borderRadius: 2 }
            : { marginTop: 12, paddingTop: 10, borderTop: '1px solid #fafafa' }
        }
      >
        {rule.weeks.map((week, weekIndex) => (
          <div
            key={weekIndex}
            style={
              table
                ? { padding: '6px 8px', borderTop: weekIndex ? '1px solid #e8e8e8' : undefined }
                : { marginTop: weekIndex ? 4 : 0 }
            }
          >
            <Text type="secondary" style={{ fontSize: 11 }}>Week {weekIndex + 1} Standby: </Text>
            <Text style={{ fontSize: 11 }}>{standbySummary(week)}</Text>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Tab label with the count as a filled circle rather than "(n)", matching the
 * badge the routes module already uses.
 */
function tabLabel(text: string, count: number) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {text}
      <Badge
        count={count}
        showZero
        style={{ backgroundColor: count ? '#1677ff' : '#bfbfbf', fontSize: 11, minWidth: 18, height: 18, lineHeight: '18px', padding: '0 5px' }}
      />
    </span>
  )
}

export default function ManageRosterDrawer({
  open,
  cardStyle = 'plain',
  onClose,
  onRulesChanged,
}: {
  open: boolean
  /** Demo variant 7 — the older page variants do not offer the switcher. */
  cardStyle?: PatternCardStyle
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
        cardStyle={cardStyle}
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
            { key: 'Current', label: tabLabel('Current', byBucket.Current.length), children: renderList('Current') },
            { key: 'Upcoming', label: tabLabel('Upcoming', byBucket.Upcoming.length), children: renderList('Upcoming') },
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
