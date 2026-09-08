// MOVE-4019 (view) / MOVE-3221 (create) / MOVE-3559 (edit) — the three drawers
// that hang off the Manage Leave Types page.
//
// Kept in one file because they share the same field vocabulary: entitlement +
// unit, effective/end dates, supporting document, encashment, eligibility.
// Splitting them would have meant three copies of the option lists and the
// same field-enablement rules written three times.

import { useEffect, useState } from 'react'
import {
  Button, DatePicker, Drawer, Input, InputNumber, Radio, Select, Space, Tag, Typography,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { EditOutlined } from '@ant-design/icons'
import {
  CURRENT_USER,
  ELIGIBILITY_LABEL,
  ENCASHMENT_LABEL,
  LEAVE_TYPES,
  nextId,
  type Encashment,
  type EmployeeEligibility,
  type EntitlementUnit,
  type LeaveType,
  type SupportingDocumentRule,
} from './leaveData'

const { Text, Title } = Typography

const UNIT_OPTIONS = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
]

const ENCASHMENT_OPTIONS = (Object.keys(ENCASHMENT_LABEL) as Encashment[]).map((v) => ({
  value: v,
  label: ENCASHMENT_LABEL[v],
}))

/** MOVE-3221 biz req 2 — the four options a user may pick at creation. */
const ELIGIBILITY_OPTIONS: EmployeeEligibility[] = ['all', 'drivers', 'non-drivers', 'selected']

const LEAVE_TYPE_NAME_MAX = 80

/** MOVE-1977 / MOVE-4019 — "12 days", "16 weeks", or "-". */
export function entitlementLabel(t: LeaveType): string {
  if (t.entitlement === null) return '-'
  return `${t.entitlement} ${t.unit}`
}

/** MOVE-4019 — system types show their fixed wording, custom ones their dates. */
export function validityLabelOf(t: LeaveType): string {
  if (!t.system && t.effectiveDate && t.endDate) {
    return `${dayjs(t.effectiveDate).format('D MMM YYYY')} - ${dayjs(t.endDate).format('D MMM YYYY')}`
  }
  return t.validityLabel
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>{label}</Text>
      {children}
    </div>
  )
}

function ReadRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid #f5f5f5' }}>
      <Text style={{ fontSize: 12, color: '#8c8c8c', width: 150, flexShrink: 0 }}>{label}</Text>
      <div style={{ fontSize: 13, minWidth: 0 }}>{value}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MOVE-4019 — View leave type details
// ---------------------------------------------------------------------------

export function LeaveTypeDetailsDrawer({
  leaveType,
  onClose,
  onEdit,
}: {
  leaveType: LeaveType | null
  onClose: () => void
  onEdit: (t: LeaveType) => void
}) {
  if (!leaveType) return <Drawer open={false} onClose={onClose} />
  const t = leaveType
  return (
    <Drawer
      open
      onClose={onClose}
      width={480}
      title={t.name}
      // Biz req 2 — Edit is allowed on every leave type, system ones included.
      extra={
        <Button type="primary" icon={<EditOutlined />} onClick={() => onEdit(t)}>
          Edit
        </Button>
      }
    >
      <ReadRow label="Entitlement" value={entitlementLabel(t)} />
      <ReadRow label="Validity Period" value={validityLabelOf(t)} />
      <ReadRow label="Supporting Document" value={t.supportingDocument === 'required' ? 'Required' : 'Optional'} />
      <ReadRow label="Encashment" value={ENCASHMENT_LABEL[t.encashment]} />
      <ReadRow label="Employee Eligibility" value={ELIGIBILITY_LABEL[t.eligibility]} />

      <div style={{ height: 20 }} />
      <Text style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600 }}>Additional Information</Text>
      <div style={{ marginTop: 8 }}>
        <ReadRow label="Last Updated On" value={dayjs(t.lastUpdatedOn).format('D MMM YYYY, h:mm A')} />
        <ReadRow label="Last Updated By" value={t.lastUpdatedBy} />
        {/* Biz req 1 — a system type has no creation record: "-" and "system". */}
        <ReadRow label="Created On" value={t.createdOn ? dayjs(t.createdOn).format('D MMM YYYY, h:mm A') : '-'} />
        <ReadRow label="Created By" value={t.createdBy} />
      </div>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// MOVE-3221 — Create leave type
// ---------------------------------------------------------------------------

export function CreateLeaveTypeDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (t: LeaveType, message: string) => void
}) {
  const [name, setName] = useState('')
  const [entitlement, setEntitlement] = useState<number | null>(0)
  const [unit, setUnit] = useState<EntitlementUnit>('days')
  const [effective, setEffective] = useState<Dayjs | null>(null)
  const [end, setEnd] = useState<Dayjs | null>(null)
  const [doc, setDoc] = useState<SupportingDocumentRule>('optional')
  const [encashment, setEncashment] = useState<Encashment>('not-available')
  const [eligibility, setEligibility] = useState<EmployeeEligibility>('all')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(''); setEntitlement(0); setUnit('days'); setEffective(null); setEnd(null)
    setDoc('optional'); setEncashment('not-available'); setEligibility('all'); setTouched(false)
  }, [open])

  const trimmed = name.trim()
  // Biz req 4 — the duplicate check spans both custom and pre-created types.
  const duplicate =
    trimmed.length > 0 && LEAVE_TYPES.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())
  const missingName = trimmed.length === 0
  const missingDates = !effective || !end
  // Biz req 2 — end date must be after effective date, not merely different.
  const badRange = !!effective && !!end && !end.isAfter(effective, 'day')
  const invalid = missingName || duplicate || missingDates || badRange || entitlement === null

  const nameError = touched && (missingName || duplicate)

  const save = () => {
    setTouched(true)
    if (invalid) return
    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    const created: LeaveType = {
      id: nextId('lt'),
      name: trimmed,
      system: false,
      entitlement,
      unit,
      validity: 'custom',
      effectiveDate: effective!.format('YYYY-MM-DD'),
      endDate: end!.format('YYYY-MM-DD'),
      // A custom type's dates are fixed, so it does not recur by itself.
      autoRecur: false,
      supportingDocument: doc,
      encashment,
      eligibility,
      validityLabel: `${effective!.format('D MMM YYYY')} - ${end!.format('D MMM YYYY')}`,
      lastUpdatedOn: now,
      lastUpdatedBy: CURRENT_USER,
      createdOn: now,
      createdBy: CURRENT_USER,
    }
    // Biz req 4 — the new type appears at the top of the custom table, which
    // the page's default "newest first" sort gives us for free.
    LEAVE_TYPES.push(created)
    onCreated(
      created,
      eligibility === 'selected'
        ? `${created.name} created. Add it to individual employees from their leave profile.`
        : `${created.name} created and added to eligible employees' leave profiles.`,
    )
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title="Create Leave Type"
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={save}>Save</Button>
        </Space>
      }
    >
      <Field label="Leave Type">
        <Input
          value={name}
          maxLength={LEAVE_TYPE_NAME_MAX}
          showCount
          status={nameError ? 'error' : undefined}
          placeholder="e.g. Study Leave"
          onChange={(e) => setName(e.target.value)}
        />
        {touched && duplicate && (
          <Text type="danger" style={{ fontSize: 12 }}>A leave type with this name already exists.</Text>
        )}
        {touched && missingName && (
          <Text type="danger" style={{ fontSize: 12 }}>Leave type name is required.</Text>
        )}
      </Field>

      <Field label="Entitlement">
        <Space.Compact style={{ width: '100%' }}>
          {/* Biz req 2 — integers only, and 0 is a legitimate entitlement. */}
          <InputNumber
            min={0}
            precision={0}
            style={{ width: '60%' }}
            value={entitlement}
            onChange={(v) => setEntitlement(v)}
          />
          <Select
            style={{ width: '40%' }}
            value={unit}
            onChange={(v) => setUnit(v as EntitlementUnit)}
            options={UNIT_OPTIONS}
          />
        </Space.Compact>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Effective Date">
          <DatePicker
            style={{ width: '100%' }}
            value={effective}
            onChange={setEffective}
            status={touched && !effective ? 'error' : undefined}
          />
        </Field>
        <Field label="End Date">
          <DatePicker
            style={{ width: '100%' }}
            value={end}
            onChange={setEnd}
            status={touched && (!end || badRange) ? 'error' : undefined}
            // Cheaper than an error message: the invalid half of the calendar
            // is simply not offered.
            disabledDate={(d) => (effective ? !d.isAfter(effective, 'day') : false)}
          />
        </Field>
      </div>
      {touched && badRange && (
        <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: -8, marginBottom: 12 }}>
          End date must be after the effective date.
        </Text>
      )}

      <Field label="Supporting Document">
        <Radio.Group value={doc} onChange={(e) => setDoc(e.target.value)}>
          <Radio value="required">Required</Radio>
          <Radio value="optional">Optional</Radio>
        </Radio.Group>
      </Field>

      <Field label="Encashment">
        <Select
          style={{ width: '100%' }}
          value={encashment}
          onChange={(v) => setEncashment(v as Encashment)}
          options={ENCASHMENT_OPTIONS}
        />
      </Field>

      <Field label="Employee Eligibility">
        {/* Biz req 3 — this choice decides whether the type is auto-added to
            profiles or has to be added by hand per employee. */}
        <Radio.Group
          value={eligibility}
          onChange={(e) => setEligibility(e.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {ELIGIBILITY_OPTIONS.map((v) => (
            <Radio key={v} value={v}>{ELIGIBILITY_LABEL[v]}</Radio>
          ))}
        </Radio.Group>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
          {eligibility === 'selected'
            ? 'Not added automatically — you add it per employee from their leave profile.'
            : 'Added automatically to every matching active employee’s leave profile.'}
        </Text>
      </Field>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// MOVE-3559 — Edit leave type
// ---------------------------------------------------------------------------

/**
 * Which fields this type allows editing, per MOVE-3559's acceptance criteria.
 * The rule is genuinely four-way, so it is computed once here rather than
 * repeated as `disabled` expressions across six controls.
 */
export function editableFields(t: LeaveType, today = dayjs()) {
  const effectivePassed = !!t.effectiveDate && dayjs(t.effectiveDate).isBefore(today, 'day')
  const endPassed = !!t.endDate && dayjs(t.endDate).isBefore(today, 'day')
  if (t.system) {
    // System types: entitlement, supporting document and encashment only.
    return { entitlement: true, effectiveDate: false, endDate: false, doc: true, encashment: true }
  }
  return {
    entitlement: !endPassed,
    effectiveDate: !effectivePassed,
    endDate: true,
    doc: true,
    encashment: true,
  }
}

export function EditLeaveTypeDrawer({
  leaveType,
  onClose,
  onSaved,
}: {
  leaveType: LeaveType | null
  onClose: () => void
  onSaved: (t: LeaveType, message: string) => void
}) {
  const [entitlement, setEntitlement] = useState<number | null>(0)
  const [unit, setUnit] = useState<EntitlementUnit>('days')
  const [effective, setEffective] = useState<Dayjs | null>(null)
  const [end, setEnd] = useState<Dayjs | null>(null)
  const [doc, setDoc] = useState<SupportingDocumentRule>('optional')
  const [encashment, setEncashment] = useState<Encashment>('not-available')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!leaveType) return
    setEntitlement(leaveType.entitlement)
    setUnit(leaveType.unit)
    setEffective(leaveType.effectiveDate ? dayjs(leaveType.effectiveDate) : null)
    setEnd(leaveType.endDate ? dayjs(leaveType.endDate) : null)
    setDoc(leaveType.supportingDocument)
    setEncashment(leaveType.encashment)
    setTouched(false)
  }, [leaveType])

  if (!leaveType) return <Drawer open={false} onClose={onClose} />
  const t = leaveType
  const can = editableFields(t)

  const badRange = !t.system && !!effective && !!end && !end.isAfter(effective, 'day')
  const invalid = entitlement === null || badRange || (!t.system && (!effective || !end))

  const save = () => {
    setTouched(true)
    if (invalid) return
    // Biz req 3 — edits take effect immediately for every eligible employee.
    // Mutating in place is what makes that true here: the balances table reads
    // this same object.
    t.entitlement = entitlement
    t.unit = unit
    t.supportingDocument = doc
    t.encashment = encashment
    if (can.effectiveDate && effective) t.effectiveDate = effective.format('YYYY-MM-DD')
    if (can.endDate && end) t.endDate = end.format('YYYY-MM-DD')
    if (!t.system && t.effectiveDate && t.endDate) {
      t.validityLabel = `${dayjs(t.effectiveDate).format('D MMM YYYY')} - ${dayjs(t.endDate).format('D MMM YYYY')}`
    }
    t.lastUpdatedOn = dayjs().format('YYYY-MM-DDTHH:mm:ss')
    t.lastUpdatedBy = CURRENT_USER
    onSaved(t, `${t.name} updated.`)
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width={520}
      title={`Edit ${t.name}`}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={save}>Save</Button>
        </Space>
      }
    >
      {/* Says up front why half the form may be read-only, rather than leaving
          the user to work it out from the greyed controls. */}
      <div style={{ background: '#f6f8fa', border: '1px solid #e8eaed', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: '#595959' }}>
          {t.system
            ? 'System leave type — its validity period and eligibility are fixed. Entitlement, supporting document and encashment can be changed.'
            : 'Custom leave type. Dates that have already passed can no longer be edited, and the name and eligibility are fixed after creation.'}
        </Text>
      </div>

      <Field label="Entitlement">
        <Space.Compact style={{ width: '100%' }}>
          <InputNumber
            min={0}
            precision={0}
            disabled={!can.entitlement}
            style={{ width: '60%' }}
            value={entitlement}
            onChange={(v) => setEntitlement(v)}
          />
          <Select
            style={{ width: '40%' }}
            disabled={!can.entitlement}
            value={unit}
            onChange={(v) => setUnit(v as EntitlementUnit)}
            options={UNIT_OPTIONS}
          />
        </Space.Compact>
      </Field>

      {t.system ? (
        // Biz req 2 — for a system type the period is display-only, shown as
        // the manage page words it rather than as an inert date picker.
        <Field label="Validity Period">
          <Text style={{ fontSize: 13 }}>{t.validityLabel}</Text>
        </Field>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Effective Date">
              <DatePicker
                style={{ width: '100%' }}
                disabled={!can.effectiveDate}
                value={effective}
                onChange={setEffective}
              />
            </Field>
            <Field label="End Date">
              <DatePicker
                style={{ width: '100%' }}
                disabled={!can.endDate}
                value={end}
                onChange={setEnd}
                status={touched && badRange ? 'error' : undefined}
                disabledDate={(d) => (effective ? !d.isAfter(effective, 'day') : false)}
              />
            </Field>
          </div>
          {touched && badRange && (
            <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: -8, marginBottom: 12 }}>
              End date must be after the effective date.
            </Text>
          )}
        </>
      )}

      <Field label="Supporting Document">
        <Radio.Group value={doc} onChange={(e) => setDoc(e.target.value)}>
          <Radio value="required">Required</Radio>
          <Radio value="optional">Optional</Radio>
        </Radio.Group>
      </Field>

      <Field label="Encashment">
        <Select
          style={{ width: '100%' }}
          value={encashment}
          onChange={(v) => setEncashment(v as Encashment)}
          options={ENCASHMENT_OPTIONS}
        />
      </Field>

      <Field label="Employee Eligibility">
        {/* Biz req 2 — display only, on every type. */}
        <Tag style={{ fontSize: 12 }}>{ELIGIBILITY_LABEL[t.eligibility]}</Tag>
      </Field>

      <Title level={5} style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginTop: 20 }}>
        What changes when you save
      </Title>
      {/* Biz req 3 in plain words — the consequences differ per field, and the
          encashment one is a real "nothing happens yet", worth saying. */}
      <ul style={{ margin: '6px 0 0 18px', padding: 0, color: '#595959', fontSize: 12 }}>
        <li>Entitlement and dates apply immediately to every eligible employee’s leave profile. Existing applications are untouched.</li>
        <li>Supporting document applies immediately to the apply-leave drawer.</li>
        <li>Encashment has no effect yet (MVP 1).</li>
      </ul>
    </Drawer>
  )
}
