// MOVE-3610 (Create Roster Rule) + MOVE-3611 (Edit Roster Rule).
//
// One modal serves both, because MOVE-3611 §2 is defined as "same field
// validations as Create" plus a lock-down: a rule that has already taken effect
// (Current) exposes only its End Date, hides + Add Repeating Pattern, and hides
// the per-pattern Delete action.

import { useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Checkbox, DatePicker, InputNumber, Modal, Tag, Tooltip, Typography, message } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  OPERATIONS_EMPLOYEES,
  ROSTER_RULES,
  type PatternWeek,
  type RosterRule,
  type RosterRulePattern,
  type ShiftCode,
} from './rosterData'
import { ISO, SHIFT_LABEL, defaultNextEffectiveDate, findOverlappingRule } from './rosterStatusLogic'

const { Text } = Typography

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKEND_INDEXES = [5, 6] // Saturday, Sunday within a Monday-first week

const SHIFT_STYLE: Record<ShiftCode, { bg: string; fg: string }> = {
  AM: { bg: '#e6f4ff', fg: '#0958d9' },
  PM: { bg: '#f6ffed', fg: '#389e0d' },
  OFF: { bg: '#f5f5f5', fg: '#8c8c8c' },
}

/** MOVE-3610: weekdays cycle AM → PM → Off Day → AM; weekends cycle AM → Off Day → AM. */
function nextShift(current: ShiftCode, weekend: boolean): ShiftCode {
  if (weekend) return current === 'AM' ? 'OFF' : 'AM'
  return current === 'AM' ? 'PM' : current === 'PM' ? 'OFF' : 'AM'
}

function defaultWeek(): PatternWeek {
  return { days: ['AM', 'AM', 'AM', 'AM', 'AM', 'OFF', 'OFF'], standby: false }
}

function newPattern(weekCount: number): RosterRulePattern {
  return {
    id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    weeks: Array.from({ length: weekCount }, defaultWeek),
    employeeIds: [],
  }
}

/** Grow or shrink every pattern's week list, preserving existing weeks. */
function resizeWeeks(patterns: RosterRulePattern[], weekCount: number): RosterRulePattern[] {
  return patterns.map((p) => {
    const weeks = p.weeks.slice(0, weekCount)
    while (weeks.length < weekCount) weeks.push(defaultWeek())
    return { ...p, weeks }
  })
}

export interface RosterRuleModalProps {
  open: boolean
  /** Existing rule to edit; omit to create a new one. */
  rule?: RosterRule
  /** MOVE-3611: a Current rule locks everything except its End Date. */
  lockedToEndDateOnly?: boolean
  onCancel: () => void
  onSave: (rule: RosterRule) => void
}

export default function RosterRuleModal({
  open,
  rule,
  lockedToEndDateOnly = false,
  onCancel,
  onSave,
}: RosterRuleModalProps) {
  const isEdit = !!rule
  const today = useMemo(() => dayjs().startOf('day'), [])

  const [effectiveDate, setEffectiveDate] = useState<Dayjs>(today)
  const [endDate, setEndDate] = useState<Dayjs | null>(null)
  const [repeatEvery, setRepeatEvery] = useState(1)
  const [patterns, setPatterns] = useState<RosterRulePattern[]>([newPattern(1)])
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!open) return
    setShowErrors(false)
    if (rule) {
      setEffectiveDate(dayjs(rule.effectiveDate))
      setEndDate(rule.endDate ? dayjs(rule.endDate) : null)
      setRepeatEvery(rule.repeatEveryWeeks)
      setPatterns(rule.patterns.map((p) => ({ ...p, weeks: p.weeks.map((w) => ({ ...w, days: [...w.days] })) })))
    } else {
      // MOVE-3610: default to the day after the latest existing rule's End Date,
      // and pre-fill the patterns of the most recently created rule.
      const nextEffective = defaultNextEffectiveDate(ROSTER_RULES, today)
      const sortedRules = [...ROSTER_RULES].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
      const latest: RosterRule | undefined = sortedRules[sortedRules.length - 1]
      setEffectiveDate(nextEffective)
      setEndDate(null) // End Date is deliberately not copied.
      setRepeatEvery(latest?.repeatEveryWeeks ?? 1)
      setPatterns(
        latest
          ? latest.patterns.map((p, i) => ({
              ...p,
              id: `pattern-${Date.now()}-${i}`,
              weeks: p.weeks.map((w) => ({ ...w, days: [...w.days] })),
              employeeIds: [...p.employeeIds],
            }))
          : [newPattern(1)]
      )
    }
  }, [open, rule, today])

  const readOnly = lockedToEndDateOnly

  const assignableEmployees = useMemo(
    () => OPERATIONS_EMPLOYEES.filter((e) => e.department === 'Operations' && e.status === 'Active'),
    []
  )

  const handleRepeatChange = (value: number | null) => {
    const weeks = Math.max(1, Math.min(8, value ?? 1))
    setRepeatEvery(weeks)
    setPatterns((prev) => resizeWeeks(prev, weeks))
  }

  const cycleCell = (patternId: string, weekIndex: number, dayIndex: number) => {
    if (readOnly) return
    setPatterns((prev) =>
      prev.map((p) => {
        if (p.id !== patternId) return p
        const weeks = p.weeks.map((w, wi) => {
          if (wi !== weekIndex) return w
          const days = [...w.days]
          days[dayIndex] = nextShift(days[dayIndex], WEEKEND_INDEXES.includes(dayIndex))
          return { ...w, days }
        })
        return { ...p, weeks }
      })
    )
  }

  const toggleStandby = (patternId: string, weekIndex: number, checked: boolean) => {
    setPatterns((prev) =>
      prev.map((p) =>
        p.id === patternId
          ? { ...p, weeks: p.weeks.map((w, wi) => (wi === weekIndex ? { ...w, standby: checked } : w)) }
          : p
      )
    )
  }

  const toggleEmployee = (patternId: string, employeeId: string) => {
    if (readOnly) return
    setPatterns((prev) =>
      prev.map((p) => {
        if (p.id !== patternId) return p
        const assigned = p.employeeIds.includes(employeeId)
        return {
          ...p,
          employeeIds: assigned ? p.employeeIds.filter((id) => id !== employeeId) : [...p.employeeIds, employeeId],
        }
      })
    )
  }

  const assignedElsewhere = (patternId: string, employeeId: string) =>
    patterns.some((p) => p.id !== patternId && p.employeeIds.includes(employeeId))

  const endDateError = (() => {
    if (!endDate) return 'End Date is required'
    if (endDate.isBefore(effectiveDate, 'day')) return 'End Date cannot be earlier than the Effective Date'
    if (endDate.isBefore(today, 'day')) return 'End Date cannot be earlier than today'
    return null
  })()

  const emptyPatterns = patterns.filter((p) => p.employeeIds.length === 0)

  const handleSave = () => {
    setShowErrors(true)

    if (endDateError) {
      message.error('Unable to save. Please review the highlighted fields.')
      return
    }
    if (!readOnly && emptyPatterns.length > 0) {
      message.error('Unable to save. Every pattern needs at least one assigned employee.')
      return
    }

    const candidate: RosterRule = {
      id: rule?.id ?? `rule-${Date.now()}`,
      effectiveDate: effectiveDate.format(ISO),
      endDate: endDate!.format(ISO),
      repeatEveryWeeks: repeatEvery,
      patterns,
    }

    // MOVE-3609 §5 — rules may not overlap.
    const clash = findOverlappingRule(ROSTER_RULES, candidate)
    if (clash) {
      message.error(
        `Unable to save. This period overlaps the rule effective ${dayjs(clash.effectiveDate).format('D MMM YYYY')}. Edit that rule instead.`
      )
      return
    }

    onSave(candidate)
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Edit Roster Rule' : 'Create Roster Rule'}
      onCancel={onCancel}
      onOk={handleSave}
      okText={isEdit ? 'Save' : 'Create'}
      width={860}
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 } }}
    >
      {readOnly && (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
          <Text style={{ fontSize: 12 }}>
            This rule has already taken effect. Only the End Date can be changed.
          </Text>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <Field label="Effective Date" required>
          {/* View-only per MOVE-3610 — the system derives it from the previous rule. */}
          <DatePicker value={effectiveDate} disabled style={{ width: 180 }} format="D MMM YYYY" />
        </Field>
        <Field label="End Date" required error={showErrors ? endDateError : null}>
          <DatePicker
            value={endDate}
            onChange={(d) => setEndDate(d)}
            style={{ width: 180 }}
            format="D MMM YYYY"
            status={showErrors && endDateError ? 'error' : undefined}
            disabledDate={(d) => d.isBefore(effectiveDate, 'day') || d.isBefore(today, 'day')}
          />
        </Field>
        <Field label="Repeat Every" required>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <InputNumber min={1} max={8} value={repeatEvery} onChange={handleRepeatChange} disabled={readOnly} style={{ width: 80 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>week(s)</Text>
          </div>
        </Field>
      </div>

      {patterns.map((pattern, index) => (
        <div
          key={pattern.id}
          style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, marginBottom: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text strong style={{ fontSize: 13 }}>Pattern {index + 1}</Text>
            {!readOnly && patterns.length > 1 && (
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setPatterns((prev) => prev.filter((p) => p.id !== pattern.id))}
              >
                Remove
              </Button>
            )}
          </div>

          {pattern.weeks.map((weekData, weekIndex) => (
            <div key={weekIndex} style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Week {weekIndex + 1}</Text>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {weekData.days.map((shift, dayIndex) => {
                  const weekend = WEEKEND_INDEXES.includes(dayIndex)
                  const style = SHIFT_STYLE[shift]
                  return (
                    <Tooltip
                      key={dayIndex}
                      title={readOnly ? SHIFT_LABEL[shift] : `${SHIFT_LABEL[shift]} — click to cycle`}
                    >
                      <div
                        onClick={() => cycleCell(pattern.id, weekIndex, dayIndex)}
                        style={{
                          width: 66,
                          borderRadius: 6,
                          border: '1px solid #f0f0f0',
                          padding: '6px 0',
                          textAlign: 'center',
                          cursor: readOnly ? 'default' : 'pointer',
                          background: style.bg,
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ fontSize: 10, color: weekend ? '#cf1322' : '#8c8c8c' }}>{DAY_LABELS[dayIndex]}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: style.fg }}>
                          {shift === 'OFF' ? 'Off' : shift}
                        </div>
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
              <Checkbox
                checked={weekData.standby}
                disabled={readOnly}
                onChange={(e) => toggleStandby(pattern.id, weekIndex, e.target.checked)}
                style={{ marginTop: 8, fontSize: 12 }}
              >
                Standby for this week
              </Checkbox>
            </div>
          ))}

          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Assigned Employees {!readOnly && <span style={{ color: '#cf1322' }}>*</span>}
            </Text>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {assignableEmployees.map((employee) => {
                const selected = pattern.employeeIds.includes(employee.id)
                const takenElsewhere = assignedElsewhere(pattern.id, employee.id)
                const disabled = readOnly || takenElsewhere
                const chip = (
                  <Tag.CheckableTag
                    key={employee.id}
                    checked={selected}
                    onChange={() => !disabled && toggleEmployee(pattern.id, employee.id)}
                    style={{
                      fontSize: 12,
                      padding: '2px 10px',
                      borderRadius: 12,
                      border: '1px solid #f0f0f0',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled && !selected ? 0.45 : 1,
                    }}
                  >
                    {employee.name}
                  </Tag.CheckableTag>
                )
                return takenElsewhere ? (
                  <Tooltip key={employee.id} title="Already assigned to another pattern in this rule">
                    <span>{chip}</span>
                  </Tooltip>
                ) : (
                  chip
                )
              })}
            </div>
            {showErrors && !readOnly && pattern.employeeIds.length === 0 && (
              <div style={{ marginTop: 6 }}>
                <Text type="danger" style={{ fontSize: 11 }}>Assign at least one employee to this pattern</Text>
              </div>
            )}
          </div>
        </div>
      ))}

      {!readOnly && (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => setPatterns((prev) => [...prev, newPattern(repeatEvery)])}
          block
        >
          Add Repeating Pattern
        </Button>
      )}
    </Modal>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {label} {required && <span style={{ color: '#cf1322' }}>*</span>}
        </Text>
      </div>
      {children}
      {error && (
        <div style={{ marginTop: 2 }}>
          <Text type="danger" style={{ fontSize: 11 }}>{error}</Text>
        </div>
      )}
    </div>
  )
}
