// Personal Dashboard (epic MOVE-3412) — page shell.
//
// A genuinely top-level destination: unlike the earlier build, this is not
// hidden behind another page's pill toggle, and it shares no UI component
// with `personaldashboard/PersonalDashboardLeaveTab.tsx` — see
// `EmployeePortalLeaveDrawers.tsx`'s header note for the reasoning.
//
// Scope of the 4 tabs, per the epic's own children:
//   Home    MOVE-3949 — ticket description is empty, so this is a light
//           welcome/quick-links panel rather than an invented dashboard.
//   Leave   MOVE-3946/3947/3948/3950/3952/3956/3965 — built out fully.
//   Claims  MOVE-3776/3943/3945/3958/3964 — built out fully. An earlier pass
//           called these "a separate domain, not part of this epic's own
//           build" and left the tab as a placeholder; that was a misreading,
//           caught on review — all five carry complete field tables and
//           acceptance criteria, the same shape as the Leave tickets. Only
//           MOVE-3944 ([x], cancelled) and MOVE-3960/MOVE-3963 ([KIV],
//           notifications) are genuinely empty.
//   Pay Slip MOVE-3953/3954 have empty descriptions — nothing to build from,
//           so this tab is the same kind of placeholder.

import { useState } from 'react'
import { Card, Empty, Space, Tag, Typography } from 'antd'
import PageTabs from '../common/PageTabs'
import EmployeePortalLeaveTab from './EmployeePortalLeaveTab'
import EmployeePortalClaimsTab from './EmployeePortalClaimsTab'

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
              These tickets carry no build-able requirements for this tab — they either have empty
              descriptions or describe a separate module. Nothing is built here so this isn't mistaken
              for a real spec.
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

function HomeTab() {
  return (
    <Card>
      <Title level={4} style={{ marginTop: 0 }}>Welcome</Title>
      <Paragraph type="secondary">
        MOVE-3949 (this tab's ticket) has no description to build from, so this stays a plain welcome
        panel. Use the Leave tab to apply for leave, review your balances, or act on applications waiting
        for your approval.
      </Paragraph>
    </Card>
  )
}

const TAB_KEYS = ['home', 'leave', 'claims', 'payslip'] as const
type TabKey = (typeof TAB_KEYS)[number]

export default function EmployeePortalPage() {
  const [activeKey, setActiveKey] = useState<TabKey>('leave')

  return (
    <div style={{ padding: 24 }}>
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

      {/* Every panel stays mounted (display:none when inactive) rather than
          unmounting on switch, matching AntD Tabs' own default behaviour —
          so a tab's local state (open filters, an open drawer) survives
          switching away and back. */}
      <div style={{ display: activeKey === 'home' ? 'block' : 'none' }}><HomeTab /></div>
      <div style={{ display: activeKey === 'leave' ? 'block' : 'none' }}><EmployeePortalLeaveTab /></div>
      <div style={{ display: activeKey === 'claims' ? 'block' : 'none' }}><EmployeePortalClaimsTab /></div>
      <div style={{ display: activeKey === 'payslip' ? 'block' : 'none' }}>
        <NotSpecifiedTab title="Pay Slip" tickets={['MOVE-3953', 'MOVE-3954']} />
      </div>
    </div>
  )
}
