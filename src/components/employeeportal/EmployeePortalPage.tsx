// Personal Dashboard (epic MOVE-3412) — page shell + homepage.
//
// A genuinely top-level destination that shares no UI component with
// `personaldashboard/PersonalDashboardLeaveTab.tsx` — see
// `EmployeePortalLeaveDrawers.tsx`'s header note for the reasoning.
//
//   Home     MOVE-3949 — Recent Activity (last 7 days), leave balances
//            (annual + medical, "View more" → Leave), Apply Leave / Submit
//            Claim primary CTAs. Rebuilt from the 13 Oct 2026 description.
//   Leave    MOVE-3948 / 3946 / 3950 / 3952 / 3965 / 4351.
//   Claims   MOVE-3943 / 3776 / 3958 / 3945 / 3964 — on the HR Claims model.
//   Pay Slip MOVE-3953/3954 — still no build-able description, so a placeholder.
//            (Pay slip activity cards are KIV in MOVE-3949 too.)
//
// The tickets describe a side nav inside the personal dashboard; this
// prototype keeps the page's existing top tab bar (`common/PageTabs`).
//
// "Viewing as" is a prototype-only switch: MOVE-3948 / MOVE-3943 show tabs
// (My … / Approvals) only to approvers, so the page needs a non-approver to
// show the no-tabs layout too.

import { useMemo, useState } from 'react'
import { Button, Card, Empty, Segmented, Space, Tag, Typography, message } from 'antd'
import { FileTextOutlined, PlusOutlined, WalletOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTabs from '../common/PageTabs'
import { LEAVE_APPLICATIONS, LEAVE_EMPLOYEES, LEAVE_TYPES, fullName, type LeaveApplication, type LeaveEmployee } from '../leave/leaveData'
import { formatDays, listingBalance } from '../leave/leaveLogic'
import { HR_CLAIMS, formatClaimAmount, hrClaimTypeLabel, type HrClaim } from '../hrclaims/hrClaimsData'
import { HrClaimDetailsDrawer, SubmitHrClaimDrawer } from '../hrclaims/HrClaimDrawers'
import EmployeePortalLeaveTab from './EmployeePortalLeaveTab'
import EmployeePortalClaimsTab from './EmployeePortalClaimsTab'
import { CreateLeaveApplicationDrawer, LeaveApplicationDetailsDrawer } from './EmployeePortalLeaveDrawers'
import { PORTAL_NON_APPROVER_ID, PORTAL_SELF_ID } from './employeePortalIdentity'

const { Title, Text, Paragraph } = Typography

function NotSpecifiedTab({ title, tickets }: { title: string; tickets: string[] }) {
  return (
    <Card>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: '40px 0' }}
        description={
          <div style={{ maxWidth: 440, margin: '0 auto' }}>
            <Text strong style={{ fontSize: 14 }}>{title} is not specified yet.</Text>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 14, fontSize: 13 }}>
              These tickets carry no build-able requirements for this tab, so nothing is built here.
            </Paragraph>
            <Space size={[6, 6]} wrap style={{ width: '100%', justifyContent: 'center' }}>
              {tickets.map((t) => <Tag key={t}>{t}</Tag>)}
            </Space>
          </div>
        }
      />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// MOVE-3949 biz req 2 — Recent Activity
// ---------------------------------------------------------------------------

type Activity =
  | { kind: 'leave'; key: string; title: string; content: string; at: string; app: LeaveApplication }
  | { kind: 'claim'; key: string; title: string; content: string; at: string; claim: HrClaim }

/**
 * Biz req 2.2. "Pending approval" cards stay as long as the item is pending;
 * every other card shows for 7 days from the date of that change (e.g.
 * approved on 1 Oct → shown until 7 Oct, gone on 8 Oct).
 */
function recentActivity(self: LeaveEmployee, today = dayjs()): Activity[] {
  const from = today.subtract(6, 'day').startOf('day')
  const within = (iso?: string) => !!iso && !dayjs(iso).isBefore(from) && !dayjs(iso).isAfter(today.endOf('day'))
  const out: Activity[] = []

  for (const a of LEAVE_APPLICATIONS.filter((x) => x.employeeId === self.id)) {
    const type = LEAVE_TYPES.find((t) => t.id === a.leaveTypeId)?.name ?? 'Leave'
    const content = `${type} · ${dayjs(a.startDate).format('D MMM YYYY')} - ${dayjs(a.endDate).format('D MMM YYYY')}`
    const at =
      a.status === 'Pending Approval' ? a.appliedOn
      : a.status === 'Approved' ? a.approvedOn
      : a.status === 'Rejected' ? a.rejectedOn
      : a.cancelledOn
    if (a.status === 'Pending Approval' || within(at)) {
      out.push({ kind: 'leave', key: a.id, title: `Leave ${a.status.toLowerCase()}`, content, at: at ?? a.appliedOn, app: a })
    }
  }

  for (const c of HR_CLAIMS.filter((x) => x.employeeId === self.id)) {
    const content = `${hrClaimTypeLabel(c)} · ${dayjs(c.receiptDate).format('D MMM YYYY')} - ${formatClaimAmount(c.amount)}`
    const at =
      c.status === 'Pending Approval' ? c.createdOn
      : c.status === 'Pending Payment' ? c.approvedOn
      : c.status === 'Paid' ? c.markedPaidOn
      : c.status === 'Rejected' ? c.rejectedOn
      : c.cancelledOn
    if (c.status === 'Pending Approval' || within(at)) {
      out.push({ kind: 'claim', key: c.id, title: `Claim ${c.status.toLowerCase()}`, content, at: at ?? c.createdOn, claim: c })
    }
  }

  return out.sort((a, b) => b.at.localeCompare(a.at))
}

function HomeTab({
  self,
  revision,
  onViewMoreBalances,
  onDataChanged,
}: {
  self: LeaveEmployee
  revision: number
  onViewMoreBalances: () => void
  onDataChanged: () => void
}) {
  const [applyOpen, setApplyOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [openLeave, setOpenLeave] = useState<LeaveApplication | null>(null)
  const [openClaimId, setOpenClaimId] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activity = useMemo(() => recentActivity(self), [self, revision])
  const year = dayjs().year()
  // Biz req 3 — annual leave (the driver or non-driver one, whichever applies) and medical leave.
  const al = listingBalance(self, 'AL', year)
  const ml = listingBalance(self, 'ML', year)
  const alName = self.department === 'Driver' ? 'Annual Leave (Drivers)' : 'Annual Leave'

  const changed = (msg: string) => { message.success(msg); onDataChanged() }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Hi, {self.givenName}</Title>
        {/* Biz req 4 — both are primary CTAs. */}
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setApplyOpen(true)}>Apply Leave</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setSubmitOpen(true)}>Submit Claim</Button>
        </Space>
      </div>

      <Card
        title={<span>Recent Activity <Text type="secondary" style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>Last 7 days</Text></span>}
        style={{ marginBottom: 20 }}
      >
        {activity.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No activity in the last 7 days." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {activity.map((a) => (
              <div
                key={a.kind + a.key}
                role="button"
                onClick={() => (a.kind === 'leave' ? setOpenLeave(a.app) : setOpenClaimId(a.claim.id))}
                style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', display: 'flex', gap: 12 }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0f5ff', color: '#1677ff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {a.kind === 'leave' ? <FileTextOutlined /> : <WalletOutlined />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Text strong style={{ fontSize: 13, display: 'block' }}>{a.title.charAt(0).toUpperCase() + a.title.slice(1)}</Text>
                  <Text style={{ fontSize: 12, display: 'block' }} ellipsis={{ tooltip: a.content }}>{a.content}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(a.at).format('D MMM YYYY, h:mm A')}</Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Leave Balances" extra={<Button type="link" style={{ padding: 0 }} onClick={onViewMoreBalances}>View more</Button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 260px))', gap: 12 }}>
          {[{ name: alName, value: al }, { name: 'Medical Leave', value: ml }].map((b) => (
            <div key={b.name} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '16px 18px' }}>
              <Text style={{ fontSize: 28, fontWeight: 700, display: 'block', lineHeight: 1.1 }}>{formatDays(b.value)}</Text>
              <Text type="secondary" style={{ fontSize: 13 }}>{b.name} remaining ({year})</Text>
            </div>
          ))}
        </div>
      </Card>

      <CreateLeaveApplicationDrawer
        open={applyOpen}
        employee={self}
        year={year}
        onClose={() => setApplyOpen(false)}
        onCreated={(msg) => { setApplyOpen(false); changed(msg) }}
      />
      <SubmitHrClaimDrawer
        open={submitOpen}
        employees={[self]}
        selfEmployee={self}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={(msg) => { setSubmitOpen(false); changed(msg) }}
      />
      <LeaveApplicationDetailsDrawer
        application={openLeave}
        employee={self}
        canDecide={false}
        actorName={fullName(self)}
        onClose={() => setOpenLeave(null)}
        onChanged={(msg) => { setOpenLeave(null); changed(msg) }}
      />
      <HrClaimDetailsDrawer
        claim={openClaimId ? HR_CLAIMS.find((c) => c.id === openClaimId) ?? null : null}
        variant="own"
        actorName={fullName(self)}
        onClose={() => setOpenClaimId(null)}
        onChanged={changed}
      />
    </div>
  )
}

const TAB_KEYS = ['home', 'leave', 'claims', 'payslip'] as const
type TabKey = (typeof TAB_KEYS)[number]

export default function EmployeePortalPage() {
  // MOVE-3949 biz req 1 — the homepage is the default view.
  const [activeKey, setActiveKey] = useState<TabKey>('home')
  const [selfId, setSelfId] = useState(PORTAL_SELF_ID)
  const [revision, setRevision] = useState(0)
  const bump = () => setRevision((r) => r + 1)

  const self = LEAVE_EMPLOYEES.find((e) => e.id === selfId) as LeaveEmployee
  const nonApprover = LEAVE_EMPLOYEES.find((e) => e.id === PORTAL_NON_APPROVER_ID) as LeaveEmployee
  const approver = LEAVE_EMPLOYEES.find((e) => e.id === PORTAL_SELF_ID) as LeaveEmployee

  const viewMoreBalances = () => {
    setActiveKey('leave')
    // Biz req 3 — land on the Leave page, scrolled to the balances table.
    setTimeout(() => document.getElementById('pd-leave-balances')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Prototype · viewing as</Text>
        <Segmented
          size="small"
          value={selfId}
          onChange={(v) => setSelfId(v as string)}
          options={[
            { value: approver.id, label: `${fullName(approver)} (approver)` },
            { value: nonApprover.id, label: `${fullName(nonApprover)} (not an approver)` },
          ]}
        />
      </div>

      <PageTabs
        activeKey={activeKey}
        onChange={(key) => setActiveKey(key as TabKey)}
        items={[
          { key: 'home', label: 'Home' },
          { key: 'leave', label: 'Leave' },
          { key: 'claims', label: 'Claims' },
          { key: 'payslip', label: 'Pay Slip' },
        ]}
      />

      {/* Every panel stays mounted (display:none when inactive) so a tab's
          local state survives switching away and back. Keyed by the viewer so
          switching "viewing as" starts each tab fresh. */}
      <div style={{ display: activeKey === 'home' ? 'block' : 'none' }}>
        <HomeTab key={`home-${selfId}`} self={self} revision={revision} onViewMoreBalances={viewMoreBalances} onDataChanged={bump} />
      </div>
      <div style={{ display: activeKey === 'leave' ? 'block' : 'none' }}>
        <EmployeePortalLeaveTab key={`leave-${selfId}`} self={self} dataRevision={revision} onDataChanged={bump} />
      </div>
      <div style={{ display: activeKey === 'claims' ? 'block' : 'none' }}>
        <EmployeePortalClaimsTab key={`claims-${selfId}`} self={self} dataRevision={revision} onDataChanged={bump} />
      </div>
      <div style={{ display: activeKey === 'payslip' ? 'block' : 'none' }}>
        <NotSpecifiedTab title="Pay Slip" tickets={['MOVE-3953', 'MOVE-3954']} />
      </div>
    </div>
  )
}

