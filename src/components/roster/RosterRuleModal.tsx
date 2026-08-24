// MOVE-3610 (Create) + MOVE-3611 (Edit), reshaped by the 18 Aug review.
//
// One modal serves both, because MOVE-3611 §2 is defined as "same field
// validations as Create" plus a lock-down: a rule that has already taken effect
// (Current) exposes only its End Date.
//
// The 18 Aug review replaced the per-employee pattern editor with an ADR-style
// grid: group by week, split by shift, then assign each day by employee. The
// old editor asked "which days does this group work?"; this one asks "who works
// this shift on this day?", which is how ops actually fills a roster in.

import { useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { DatePicker, InputNumber, Modal, Select, Typography, message } from 'antd'
import {
  OPERATIONS_EMPLOYEES,
  ROSTER_RULES,
  emptyRuleWeek,
  type RosterRule,
  type RuleWeek,
} from './rosterData'
import { ISO, defaultNextEffectiveDate, findOverlappingRule } from './rosterStatusLogic'

const { Text } = Typography

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKEND_INDEXES = [5, 6] // Saturday, Sunday within a Monday-first week
/** One tag per line in a day cell, so this is the three-line cap. */
const MAX_VISIBLE_TAGS = 3

const GRID_COLUMNS = '92px repeat(7, minmax(148px, 1fr))'

function cloneWeek(week: RuleWeek): RuleWeek {
  return {
    am: week.am.map((d) => [...d]),
    pm: week.pm.map((d) => [...d]),
    standby: week.standby.map((d) => [...d]),
  }
}

/** Grow or shrink the week list, preserving the weeks already filled in. */
function resizeWeeks(weeks: RuleWeek[], count: number): RuleWeek[] {
  const next = weeks.slice(0, count).map(cloneWeek)
  while (next.length < count) next.push(emptyRuleWeek())
  return next
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
  const [weeks, setWeeks] = useState<RuleWeek[]>([emptyRuleWeek()])
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!open) return
    setShowErrors(false)
    if (rule) {
      setEffectiveDate(dayjs(rule.effectiveDate))
      setEndDate(rule.endDate ? dayjs(rule.endDate) : null)
      setRepeatEvery(rule.repeatEveryWeeks)
      setWeeks(rule.weeks.map(cloneWeek))
    } else {
      // MOVE-3610: default to the day after the latest existing rule's End Date,
      // and pre-fill from the most recently created rule. The End Date is not
      // copied.
      const sorted = [...ROSTER_RULES].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
      const latest: RosterRule | undefined = sorted[sorted.length - 1]
      setEffectiveDate(defaultNextEffectiveDate(ROSTER_RULES, today))
      setEndDate(null)
      setRepeatEvery(latest?.repeatEveryWeeks ?? 1)
      setWeeks(latest ? latest.weeks.map(cloneWeek) : [emptyRuleWeek()])
    }
  }, [open, rule, today])

  const readOnly = lockedToEndDateOnly

  const assignableEmployees = useMemo(
    () =>
      OPERATIONS_EMPLOYEES.filter((e) => e.department === 'Operations' && e.status === 'Active').sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    []
  )

  /** Names come from the full roster, not just the assignable subset. */
  const nameOf = (id: string) => OPERATIONS_EMPLOYEES.find((e) => e.id === id)?.name ?? id

  const handleRepeatChange = (value: number | null) => {
    const count = Math.max(1, Math.min(8, value ?? 1))
    setRepeatEvery(count)
    setWeeks((prev) => resizeWeeks(prev, count))
  }

  const setSlot = (weekIndex: number, row: keyof RuleWeek, dayIndex: number, ids: string[]) => {
    if (readOnly) return
    setWeeks((prev) =>
      prev.map((week, wi) => {
        if (wi !== weekIndex) return week
        const next = cloneWeek(week)
        next[row][dayIndex] = ids
        return next
      })
    )
  }

  // A Current rule stays locked wholesale (MOVE-3611); otherwise the Effective
  // Date is only frozen once it is in the past.
  const effectiveDateLocked = readOnly || effectiveDate.isBefore(today, 'day')
  const effectiveDateError = effectiveDate.isBefore(today, 'day') && !effectiveDateLocked
    ? 'Effective Date cannot be in the past'
    : null

  const endDateError = (() => {
    if (!endDate) return 'End Date is required'
    if (endDate.isBefore(effectiveDate, 'day')) return 'End Date cannot be earlier than the Effective Date'
    if (endDate.isBefore(today, 'day')) return 'End Date cannot be earlier than today'
    return null
  })()

  const assignedCount = weeks.reduce(
    (total, week) =>
      total + [week.am, week.pm, week.standby].reduce((n, row) => n + row.reduce((m, day) => m + day.length, 0), 0),
    0
  )

  const handleSave = () => {
    setShowErrors(true)

    if (effectiveDateError || endDateError) {
      message.error('Unable to save. Please review the highlighted fields.')
      return
    }
    if (!readOnly && assignedCount === 0) {
      message.error('Unable to save. Assign at least one employee to a shift.')
      return
    }

    const candidate: RosterRule = {
      id: rule?.id ?? `rule-${Date.now()}`,
      effectiveDate: effectiveDate.format(ISO),
      endDate: endDate!.format(ISO),
      repeatEveryWeeks: repeatEvery,
      weeks,
    }

    // MOVE-3609 §5 — rules may not overlap.
    const clash = findOverlappingRule(ROSTER_RULES, candidate)
    if (clash) {
      message.error(
        `Unable to save. This period overlaps the shift patterns effective ${dayjs(clash.effectiveDate).format('D MMM YYYY')}. Edit those instead.`
      )
      return
    }

    onSave(candidate)
  }

  /**
   * MOVE-3769 §3 — one shift per employee per day. Somebody already on AM is
   * disabled in that day's PM list and vice versa, rather than being moved
   * silently when picked (18 Aug feedback 4). Standby is independent of the
   * shift (MOVE-3608), so it never restricts anything.
   *
   * The clash test skips anyone already in this cell, so a person who somehow
   * ended up in both lists can still be taken out of either one.
   */
  const optionsFor = (weekIndex: number, row: keyof RuleWeek, dayIndex: number) => {
    const other: keyof RuleWeek | null = row === 'am' ? 'pm' : row === 'pm' ? 'am' : null
    const taken = other ? weeks[weekIndex][other][dayIndex] : []
    const here = weeks[weekIndex][row][dayIndex]

    const selected: { value: string; label: string; disabled?: boolean }[] = []
    const available: { value: string; label: string; disabled?: boolean }[] = []
    const unavailable: { value: string; label: string; disabled?: boolean }[] = []

    for (const e of assignableEmployees) {
      if (here.includes(e.id)) selected.push({ value: e.id, label: e.name })
      else if (taken.includes(e.id)) {
        unavailable.push({ value: e.id, label: `${e.name} — on ${other!.toUpperCase()}`, disabled: true })
      } else available.push({ value: e.id, label: e.name })
    }

    // MOVE-3610 offers only Active employees, but a stored pattern can still
    // name someone since suspended or whose contract ended. They are listed so
    // the cell shows a name rather than a raw id, and so they can be taken out
    // — they just cannot be added anywhere new.
    for (const id of here) {
      if (assignableEmployees.some((e) => e.id === id)) continue
      selected.push({ value: id, label: `${nameOf(id)} — inactive` })
    }

    // Feedback — the list is grouped by state so the eye lands on what is
    // already picked before scanning what is still free.
    return [
      { label: `Selected (${selected.length})`, options: selected },
      { label: 'Available', options: available },
      { label: `Unavailable (${other ? other.toUpperCase() : ''})`, options: unavailable },
    ].filter((g) => g.options.length > 0)
  }

  const daySelect = (weekIndex: number, row: keyof RuleWeek, dayIndex: number) => {
    // PM is not permitted on a weekend (MOVE-3608 weekend rules), so the cell is
    // disabled rather than silently dropping whatever is put in it.
    const blocked = row === 'pm' && WEEKEND_INDEXES.includes(dayIndex)
    const value = weeks[weekIndex][row][dayIndex]
    return (
      <div>
        <Select
          mode="multiple"
          size="small"
          allowClear
          disabled={readOnly || blocked}
          placeholder={blocked ? '—' : 'Assign'}
          value={value}
          onChange={(ids: string[]) => setSlot(weekIndex, row, dayIndex, ids)}
          options={optionsFor(weekIndex, row, dayIndex)}
          // Feedback — the names live in the control as removable tags rather
          // than in a paragraph underneath. One tag fills a cell line, so three
          // is the height cap; the rest collapse into "+n".
          maxTagCount={MAX_VISIBLE_TAGS}
          maxTagPlaceholder={(omitted) => `+${omitted.length}`}
          style={{ width: '100%' }}
          optionFilterProp="label"
        />
        {value.length > 0 && (
          <div style={{ marginTop: 2 }}>
            <Text style={{ fontSize: 10, color: '#8c8c8c' }}>{value.length} selected</Text>
          </div>
        )}
      </div>
    )
  }

  const rowLabel = (text: string, tone?: string) => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <Text strong style={{ fontSize: 12, color: tone }}>{text}</Text>
    </div>
  )

  return (
    <Modal
      open={open}
      title={isEdit ? 'Edit Shift Patterns' : 'Add Shift Patterns'}
      onCancel={onCancel}
      onOk={handleSave}
      okText={isEdit ? 'Save' : 'Create'}
      width={1320}
      styles={{ body: { maxHeight: '68vh', overflowY: 'auto', paddingRight: 8 } }}
    >
      {readOnly && (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
          <Text style={{ fontSize: 12 }}>
            These shift patterns have already taken effect. Only the End Date can be changed.
          </Text>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <Field label="Effective Date" required error={showErrors ? effectiveDateError : null}>
          {/* MOVE-3610 derives this from the previous rule, but the 19 Aug review
              asks for it to stay editable until the date has actually passed —
              only then is it locked, since the roster it produced is history. */}
          <DatePicker
            value={effectiveDate}
            onChange={(d) => d && setEffectiveDate(d)}
            disabled={effectiveDateLocked}
            style={{ width: 180 }}
            format="D MMM YYYY"
            status={showErrors && effectiveDateError ? 'error' : undefined}
            disabledDate={(d) => d.isBefore(today, 'day')}
          />
        </Field>
        <Field label="End Date" required error={showErrors ? endDateError : null}>
          <DatePicker
            value={endDate}
            onChange={(d) => setEndDate(d)}
            style={{ width: 180 }}
            format="D MMM YYYY"
            status={showErrors && endDateError ? 'error' : undefined}
            disabledDate={(d) => d.isBefore(effectiveDate, 'day') || d.isBefore(today, 'day')}
            key={effectiveDate.format(ISO)}
          />
        </Field>
        <Field label="Repeat Every" required>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <InputNumber min={1} max={8} value={repeatEvery} onChange={handleRepeatChange} disabled={readOnly} style={{ width: 80 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>week(s)</Text>
          </div>
        </Field>
      </div>

      {/* The grid is wider than the modal on small screens, so it scrolls in its
          own container rather than making the whole page scroll sideways. */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 1184 }}>
          {weeks.map((_, weekIndex) => (
            <div key={weekIndex} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <Text strong style={{ fontSize: 13 }}>Week {weekIndex + 1}</Text>

              <div style={{ display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: 8, marginTop: 10, alignItems: 'start' }}>
                <span />
                {DAY_LABELS.map((label, dayIndex) => (
                  <Text
                    key={dayIndex}
                    strong
                    style={{ fontSize: 12, color: WEEKEND_INDEXES.includes(dayIndex) ? '#cf1322' : '#595959' }}
                  >
                    {label}
                  </Text>
                ))}

                {rowLabel('AM')}
                {DAY_LABELS.map((_, dayIndex) => (
                  <div key={`am-${dayIndex}`}>{daySelect(weekIndex, 'am', dayIndex)}</div>
                ))}

                {rowLabel('PM')}
                {DAY_LABELS.map((_, dayIndex) => (
                  <div key={`pm-${dayIndex}`}>{daySelect(weekIndex, 'pm', dayIndex)}</div>
                ))}

                {rowLabel('Standby', '#8c8c8c')}
                {DAY_LABELS.map((_, dayIndex) => (
                  <div key={`sb-${dayIndex}`}>{daySelect(weekIndex, 'standby', dayIndex)}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showErrors && !readOnly && assignedCount === 0 && (
        <Text type="danger" style={{ fontSize: 11 }}>Assign at least one employee to a shift</Text>
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
