// MOVE-3500 (add) and MOVE-3775 (edit) — the two entitlement modals, plus the
// MOVE-3888 change-history drawer they both write to.
//
// They share a set of date-enablement rules that MOVE-3775 defines by pointing
// back at MOVE-3500, so keeping them together is what stops the two drifting.

import { useEffect, useMemo, useState } from 'react'
import {
  Button, Checkbox, DatePicker, Drawer, Input, InputNumber, Modal, Select, Table, Tag, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import {
  CURRENT_USER,
  EMPLOYEE_ENTITLEMENTS,
  ENTITLEMENT_CHANGES,
  ENTITLEMENT_OVERRIDES,
  LEAVE_TYPES,
  nextId,
  type EntitlementUnit,
  type LeaveEmployee,
  type LeaveType,
} from './leaveData'
import { type BalanceRow, entitlementInDays } from './leaveLogic'

const { Text } = Typography

const UNIT_OPTIONS = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
]

/** MOVE-3500 biz req 2 — end date is auto-set a year out for these four. */
const YEAR_LONG_TYPE_IDS = ['lt-mat', 'lt-pat', 'lt-spl', 'lt-adopt']
const CHILDCARE_ID = 'lt-ccl'
const INFANT_CARE_ID = 'lt-uicl'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>{label}</Text>
      {children}
      {hint && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>{hint}</Text>}
    </div>
  )
}

function logChange(
  employeeId: string,
  editType: 'Add' | 'Edit',
  fieldEdited: string,
  previousInput: string,
  newInput: string,
) {
  ENTITLEMENT_CHANGES.unshift({
    id: nextId('ch'),
    employeeId,
    updatedOn: dayjs().format('YYYY-MM-DDTHH:mm:ss'),
    updatedBy: CURRENT_USER,
    editType,
    fieldEdited,
    previousInput,
    newInput,
  })
}

// ---------------------------------------------------------------------------
// MOVE-3500 — Add leave entitlement
// ---------------------------------------------------------------------------

export function AddEntitlementModal({
  open,
  employee,
  onClose,
  onSaved,
}: {
  open: boolean
  employee: LeaveEmployee
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [leaveTypeId, setLeaveTypeId] = useState<string | null>(null)
  const [effective, setEffective] = useState<Dayjs | null>(null)
  const [end, setEnd] = useState<Dayjs | null>(null)
  const [recurringYears, setRecurringYears] = useState<number | null>(1)
  const [entitlement, setEntitlement] = useState<number | null>(null)
  const [unit, setUnit] = useState<EntitlementUnit>('days')
  const [touched, setTouched] = useState(false)

  // Biz req 2 — only "selected employees" types can be added by hand, and only
  // ones this employee does not already have.
  const options = useMemo(() => {
    const already = new Set(
      EMPLOYEE_ENTITLEMENTS.filter((x) => x.employeeId === employee.id).map((x) => x.leaveTypeId),
    )
    return LEAVE_TYPES.filter((t) => t.eligibility === 'selected' && !already.has(t.id)).map((t) => ({
      value: t.id,
      label: t.name,
    }))
  }, [employee.id, open])

  useEffect(() => {
    if (!open) return
    setLeaveTypeId(null); setEffective(null); setEnd(null)
    setRecurringYears(1); setEntitlement(null); setUnit('days'); setTouched(false)
  }, [open])

  const type = leaveTypeId ? LEAVE_TYPES.find((t) => t.id === leaveTypeId) : undefined

  // Biz req 2, rows 2–3. A custom type carries its own fixed dates, so both
  // pickers are filled in and locked; childcare's end date is always the year
  // end; the four parental types run exactly a year from the effective date.
  const custom = !!type && !type.system
  const isChildcare = leaveTypeId === CHILDCARE_ID
  const isInfantCare = leaveTypeId === INFANT_CARE_ID
  const yearLong = !!leaveTypeId && YEAR_LONG_TYPE_IDS.includes(leaveTypeId)
  const effectiveEnabled = !!type && !custom
  const endEnabled = !!type && !custom && isInfantCare

  // Applying the defaults as the type changes keeps the derived fields honest
  // without the user having to clear them by hand.
  useEffect(() => {
    if (!type) return
    setEntitlement(type.entitlement)
    setUnit(type.unit)
    if (custom) {
      setEffective(type.effectiveDate ? dayjs(type.effectiveDate) : null)
      setEnd(type.endDate ? dayjs(type.endDate) : null)
    } else {
      setEffective(null)
      setEnd(null)
    }
  }, [leaveTypeId])

  useEffect(() => {
    if (!effective || custom) return
    if (yearLong) setEnd(effective.add(1, 'year').subtract(1, 'day'))
    else if (isChildcare) setEnd(effective.endOf('year'))
  }, [effective, leaveTypeId])

  const missing = !leaveTypeId || !effective || !end || entitlement === null || (isChildcare && !recurringYears)
  const badRange = !!effective && !!end && end.isBefore(effective, 'day')

  const save = () => {
    setTouched(true)
    if (missing || badRange || !type) return
    EMPLOYEE_ENTITLEMENTS.push({
      id: nextId('ent'),
      employeeId: employee.id,
      leaveTypeId: type.id,
      effectiveDate: effective!.format('YYYY-MM-DD'),
      endDate: end!.format('YYYY-MM-DD'),
      entitlement,
      unit,
      recurringYears: isChildcare ? recurringYears ?? 1 : undefined,
    })
    // Biz req 3 — the add shows up in the change history.
    logChange(employee.id, 'Add', type.name, '-', '-')
    onSaved(`${type.name} added to ${employee.givenName}’s leave profile.`)
  }

  const recurUntil =
    isChildcare && effective && recurringYears
      ? dayjs(`${effective.year() + recurringYears - 1}-12-31`).format('D MMM YYYY')
      : null

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Add Leave Entitlement"
      width={520}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="save" type="primary" onClick={save}>Save</Button>,
      ]}
    >
      <div style={{ marginTop: 16 }}>
        <Field
          label="Leave Type"
          hint="Only leave types set to “selected employees” need adding by hand — everything else is already on the profile."
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Search leave type"
            style={{ width: '100%' }}
            options={options}
            value={leaveTypeId}
            onChange={setLeaveTypeId}
            status={touched && !leaveTypeId ? 'error' : undefined}
            notFoundContent="Every eligible leave type is already on this profile."
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field
            label="Effective Date"
            hint={custom ? 'Set when the leave type was created' : undefined}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabled={!effectiveEnabled}
              value={effective}
              onChange={setEffective}
              status={touched && !effective ? 'error' : undefined}
            />
          </Field>
          <Field
            label="End Date"
            hint={
              custom ? 'Set when the leave type was created'
                : yearLong ? 'One year from the effective date'
                  : isChildcare ? 'Year 1 always ends on 31 Dec'
                    : undefined
            }
          >
            <DatePicker
              style={{ width: '100%' }}
              disabled={!endEnabled}
              value={end}
              onChange={setEnd}
              status={touched && (!end || badRange) ? 'error' : undefined}
              disabledDate={(d) => (effective ? !d.isAfter(effective, 'day') : false)}
            />
          </Field>
        </div>

        {/* Biz req 2 — childcare leave is the only type that asks how many
            years it should repeat for. */}
        {isChildcare && (
          <Field
            label="Recurring Years"
            hint={
              recurUntil && entitlement !== null
                ? `${entitlement} ${unit} of Childcare Leave will recur annually until ${recurUntil}`
                : undefined
            }
          >
            <InputNumber
              min={1}
              precision={0}
              style={{ width: '100%' }}
              value={recurringYears}
              onChange={setRecurringYears}
              status={touched && !recurringYears ? 'error' : undefined}
            />
          </Field>
        )}

        <Field
          label="Entitlement"
          hint="Applies to this employee only — the leave type’s own default is unchanged."
        >
          <Input.Group compact style={{ display: 'flex' }}>
            <InputNumber
              min={0}
              precision={0}
              style={{ width: '60%' }}
              value={entitlement}
              onChange={setEntitlement}
              status={touched && entitlement === null ? 'error' : undefined}
            />
            <Select
              style={{ width: '40%' }}
              value={unit}
              onChange={(v) => setUnit(v as EntitlementUnit)}
              options={UNIT_OPTIONS}
            />
          </Input.Group>
          {unit === 'weeks' && entitlement !== null && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
              = {entitlementInDays(entitlement, 'weeks', employee)} days at {employee.workingDaysPerWeek} working days per week
            </Text>
          )}
        </Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// MOVE-3775 — Edit leave entitlement
// ---------------------------------------------------------------------------

export function EditEntitlementModal({
  row,
  employee,
  year,
  onClose,
  onSaved,
}: {
  row: BalanceRow | null
  employee: LeaveEmployee
  year: number
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [entitlement, setEntitlement] = useState<number | null>(0)
  const [unit, setUnit] = useState<EntitlementUnit>('days')
  const [effective, setEffective] = useState<Dayjs | null>(null)
  const [end, setEnd] = useState<Dayjs | null>(null)
  const [applyForward, setApplyForward] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!row) return
    setEntitlement(row.entitlementValue)
    setUnit(row.entitlementUnit)
    setEffective(row.validity.effective)
    setEnd(row.validity.end)
    setApplyForward(false)
    setTouched(false)
  }, [row])

  if (!row) return <Modal open={false} onCancel={onClose} />
  const type = row.leaveType

  // Biz req 2 — a passed effective date locks that field; a passed end date
  // locks the entitlement itself.
  const today = dayjs()
  const effectivePassed = !!row.validity.effective && row.validity.effective.isBefore(today, 'day')
  const endPassed = !!row.validity.end && row.validity.end.isBefore(today, 'day')
  const hasPeriod = !!row.validity.effective && !!row.validity.end

  const newDays = entitlementInDays(entitlement, unit, employee)
  // Biz req 3 — the guard that actually matters: the new entitlement has to
  // still cover what the employee has already used and has pending.
  const projectedBalance = newDays === null ? null : newDays - row.usedDays - row.pendingDays
  const negative = projectedBalance !== null && projectedBalance < 0
  const missing = entitlement === null

  const save = () => {
    setTouched(true)
    if (missing || negative) return

    const prevValue = row.entitlementValue === null ? '-' : `${row.entitlementValue} ${row.entitlementUnit}`
    const nextValue = entitlement === null ? '-' : `${entitlement} ${unit}`

    ENTITLEMENT_OVERRIDES.push({
      employeeId: employee.id,
      leaveTypeId: type.id,
      year,
      entitlement,
      unit,
      effectiveDate: effective ? effective.format('YYYY-MM-DD') : undefined,
      endDate: end ? end.format('YYYY-MM-DD') : undefined,
      appliesForward: applyForward,
    })

    // Biz req 2.2 of MOVE-3888 — one history row per field actually changed,
    // even though they were edited in a single session.
    if (prevValue !== nextValue) {
      logChange(
        employee.id,
        'Edit',
        'Entitlement',
        prevValue,
        `${nextValue}, change ${applyForward ? 'applied' : 'not applied'} to subsequent recurring years`,
      )
    }
    if (effective && row.validity.effective && !effective.isSame(row.validity.effective, 'day')) {
      logChange(employee.id, 'Edit', 'Effective Date', row.validity.effective.format('DD MMM YYYY'), effective.format('DD MMM YYYY'))
    }
    if (end && row.validity.end && !end.isSame(row.validity.end, 'day')) {
      logChange(employee.id, 'Edit', 'End Date', row.validity.end.format('DD MMM YYYY'), end.format('DD MMM YYYY'))
    }

    onSaved(`${type.name} entitlement updated for ${year}.`)
  }

  return (
    <Modal
      open
      onCancel={onClose}
      title={`Edit ${type.name}`}
      width={520}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="save" type="primary" onClick={save}>Save</Button>,
      ]}
    >
      <div style={{ marginTop: 16 }}>
        {hasPeriod && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Effective Date" hint={effectivePassed ? 'Already passed' : undefined}>
              <DatePicker style={{ width: '100%' }} disabled={effectivePassed} value={effective} onChange={setEffective} />
            </Field>
            <Field label="End Date">
              <DatePicker
                style={{ width: '100%' }}
                value={end}
                onChange={setEnd}
                disabledDate={(d) => (effective ? !d.isAfter(effective, 'day') : false)}
              />
            </Field>
          </div>
        )}

        <Field label="Entitlement" hint={endPassed ? 'Locked — the validity period has passed' : undefined}>
          <Input.Group compact style={{ display: 'flex' }}>
            <InputNumber
              min={0}
              precision={0}
              disabled={endPassed}
              style={{ width: '60%' }}
              value={entitlement}
              onChange={setEntitlement}
              status={touched && (missing || negative) ? 'error' : undefined}
            />
            <Select
              style={{ width: '40%' }}
              disabled={endPassed}
              value={unit}
              onChange={(v) => setUnit(v as EntitlementUnit)}
              options={UNIT_OPTIONS}
            />
          </Input.Group>
        </Field>

        {/* The arithmetic is shown live rather than only on a failed save, so
            the user can see the floor they are pushing against. */}
        <div style={{ background: '#f6f8fa', border: '1px solid #e8eaed', borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: '#595959' }}>
            Used {row.usedDays} · Pending approval {row.pendingDays} · New balance{' '}
            <Text strong style={{ fontSize: 12, color: negative ? '#cf1322' : '#1a1a1a' }}>
              {projectedBalance === null ? '-' : `${projectedBalance} days`}
            </Text>
          </Text>
          {negative && (
            <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              Entitlement cannot go below what has already been used and is pending approval.
            </Text>
          )}
        </div>

        {/* Biz req 2 — only offered on types that actually recur. */}
        {type.autoRecur && (
          <Checkbox checked={applyForward} onChange={(e) => setApplyForward(e.target.checked)}>
            <Text style={{ fontSize: 13 }}>Apply this change to subsequent recurring years</Text>
          </Checkbox>
        )}
        {type.autoRecur && (
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
            {applyForward
              ? `Applies from ${year} onwards.`
              : `Applies to ${year} only.`}
          </Text>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// MOVE-3888 — Leave entitlement change history
// ---------------------------------------------------------------------------

export function ChangeHistoryDrawer({
  open,
  employee,
  onClose,
}: {
  open: boolean
  employee: LeaveEmployee
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [editTypes, setEditTypes] = useState<string[]>([])
  const [users, setUsers] = useState<string[]>([])
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)

  const all = useMemo(
    () => ENTITLEMENT_CHANGES.filter((c) => c.employeeId === employee.id),
    [employee.id, open],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all
      // Biz req 3 — the search bar covers previous and new input only.
      .filter((c) => (q ? `${c.previousInput} ${c.newInput}`.toLowerCase().includes(q) : true))
      .filter((c) => (editTypes.length ? editTypes.includes(c.editType) : true))
      .filter((c) => (users.length ? users.includes(c.updatedBy) : true))
      .filter((c) => {
        if (!range) return true
        const d = dayjs(c.updatedOn)
        return d.isAfter(range[0].startOf('day')) && d.isBefore(range[1].endOf('day'))
      })
      .sort((a, b) => b.updatedOn.localeCompare(a.updatedOn))
  }, [all, search, editTypes, users, range])

  const userOptions = useMemo(
    () => [...new Set(all.map((c) => c.updatedBy))].map((u) => ({ value: u, label: u })),
    [all],
  )

  const columns: ColumnsType<(typeof ENTITLEMENT_CHANGES)[number]> = [
    {
      title: 'Updated On',
      key: 'updatedOn',
      width: 150,
      render: (_, c) => (
        <div>
          <Text style={{ fontSize: 12, display: 'block' }}>{dayjs(c.updatedOn).format('D MMM YYYY')}</Text>
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{dayjs(c.updatedOn).format('h:mm A')}</Text>
        </div>
      ),
    },
    { title: 'Updated By', dataIndex: 'updatedBy', width: 130, render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    {
      title: 'Edit Type',
      dataIndex: 'editType',
      width: 90,
      render: (v: string) => <Tag color={v === 'Add' ? 'blue' : 'default'} style={{ fontSize: 11 }}>{v}</Tag>,
    },
    { title: 'Field Edited', dataIndex: 'fieldEdited', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Previous Input', dataIndex: 'previousInput', render: (v: string) => <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{v}</Text> },
    { title: 'New Input', dataIndex: 'newInput', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
  ]

  return (
    <Drawer open={open} onClose={onClose} width={980} title="Leave Entitlement Change History">
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Input
          size="small"
          allowClear
          placeholder="Search previous or new input"
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          size="small"
          mode="multiple"
          allowClear
          placeholder="User"
          style={{ minWidth: 160 }}
          options={userOptions}
          value={users}
          onChange={setUsers}
          maxTagCount="responsive"
        />
        <Select
          size="small"
          mode="multiple"
          allowClear
          placeholder="Edit type"
          style={{ minWidth: 150 }}
          options={[{ value: 'Add', label: 'Add' }, { value: 'Edit', label: 'Edit' }]}
          value={editTypes}
          onChange={setEditTypes}
          maxTagCount="responsive"
        />
        <DatePicker.RangePicker
          size="small"
          value={range}
          onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
          placeholder={['Date of edit', 'End date']}
        />
      </div>
      <Table
        columns={columns}
        dataSource={rows}
        rowKey="id"
        size="small"
        pagination={false}
        locale={{ emptyText: 'No entitlement changes recorded for this employee.' }}
      />
    </Drawer>
  )
}
