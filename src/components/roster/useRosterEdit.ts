// MOVE-3658 — shared Bulk Edit Roster state machine.
//
// Both roster page variants drive edit mode through this hook so the selection
// rules (what may be selected, and the weekday/weekend split) stay identical
// between them; only the cell rendering differs per page.

import { useCallback, useMemo, useState } from 'react'
import type { Dayjs } from 'dayjs'
import { message } from 'antd'
import { ROSTER_OVERRIDES, applyOverrides, type RosterOverride, type ShiftCode } from './rosterData'
import { ISO, bulkShiftOptions } from './rosterStatusLogic'

export const cellKey = (employeeId: string, date: string) => `${employeeId}|${date}`

/** MOVE-3658 §1 — edit mode is available for the current and future months only. */
export function canEditMonth(month: Dayjs, today: Dayjs): boolean {
  return !month.startOf('month').isBefore(today.startOf('month'))
}

export const PAST_MONTH_TOOLTIP =
  'Past months cannot be edited because payroll has already been generated for this period.'

export function useRosterEdit(onCommit: () => void) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<RosterOverride[]>([])
  const [selection, setSelection] = useState<Record<string, { employeeId: string; date: string; weekend: boolean }>>({})

  const selected = useMemo(() => Object.values(selection), [selection])
  const weekendSelection = selected.length > 0 ? selected[0].weekend : false
  const shiftOptions = useMemo(() => bulkShiftOptions(weekendSelection), [weekendSelection])

  /** Draft overrides layered on top of the saved ones, for live preview. */
  const previewOverrides = useMemo(
    () => (editing ? [...ROSTER_OVERRIDES, ...draft] : ROSTER_OVERRIDES),
    [editing, draft]
  )

  const start = useCallback(() => {
    setDraft([])
    setSelection({})
    setEditing(true)
  }, [])

  const clearSelection = useCallback(() => setSelection({}), [])

  const toggleCell = useCallback(
    (employeeId: string, date: string, weekend: boolean) => {
      const key = cellKey(employeeId, date)
      setSelection((prev) => {
        if (prev[key]) {
          const next = { ...prev }
          delete next[key]
          return next
        }
        const existing = Object.values(prev)
        // A selection may contain weekday cells or weekend cells, never both.
        if (existing.length > 0 && existing[0].weekend !== weekend) {
          message.error('A selection cannot mix weekday and weekend cells. Clear the selection to switch.')
          return prev
        }
        return { ...prev, [key]: { employeeId, date, weekend } }
      })
    },
    []
  )

  const applyShift = useCallback(
    (shift: ShiftCode) => {
      if (selected.length === 0) return
      setDraft((prev) => {
        const next = [...prev]
        for (const cell of selected) {
          const existing = next.find((o) => o.employeeId === cell.employeeId && o.date === cell.date)
          if (existing) existing.shift = shift
          else next.push({ employeeId: cell.employeeId, date: cell.date, shift })
        }
        return next
      })
      setSelection({})
    },
    [selected]
  )

  const applyStandby = useCallback((overrides: RosterOverride[]) => {
    setDraft((prev) => {
      const next = [...prev]
      for (const override of overrides) {
        const existing = next.find((o) => o.employeeId === override.employeeId && o.date === override.date)
        if (existing) existing.standby = override.standby
        else next.push({ ...override })
      }
      return next
    })
  }, [])

  const save = useCallback(() => {
    applyOverrides(draft)
    setDraft([])
    setSelection({})
    setEditing(false)
    onCommit()
    message.success('Roster updated successfully.')
  }, [draft, onCommit])

  const cancel = useCallback(() => {
    setDraft([])
    setSelection({})
    setEditing(false)
  }, [])

  return {
    editing,
    draft,
    hasChanges: draft.length > 0,
    previewOverrides,
    selection,
    selected,
    selectedCount: selected.length,
    weekendSelection,
    shiftOptions,
    isSelected: (employeeId: string, date: string) => !!selection[cellKey(employeeId, date)],
    start,
    toggleCell,
    clearSelection,
    applyShift,
    applyStandby,
    save,
    cancel,
    ISO,
  }
}
