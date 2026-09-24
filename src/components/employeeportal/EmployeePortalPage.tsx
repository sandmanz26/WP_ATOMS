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
//   Claims  MOVE-3776/3943/3945/3958/3964 all describe the Claims module
//           itself (a separate domain, not part of this epic's own build),
//           so this tab stays an honest "not specified here" placeholder.
//   Pay Slip MOVE-3953/3954 have empty descriptions — nothing to build from,
//           so this tab is the same kind of placeholder.

import { Card, Empty, Tabs, Typography } from 'antd'
import EmployeePortalLeaveTab from './EmployeePortalLeaveTab'

const { Title, Text, Paragraph } = Typography

function NotSpecifiedTab({ title, tickets }: { title: string; tickets: string[] }) {
  return (
    <Card>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            <Text strong>{title} is not specified yet.</Text>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
              {tickets.join(', ')} carry no build-able requirements for this tab — they either have empty
              descriptions or describe a separate module. Nothing is built here so this isn't mistaken for
              a real spec.
            </Paragraph>
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

export default function EmployeePortalPage() {
  return (
    <Tabs
      defaultActiveKey="leave"
      items={[
        { key: 'home', label: 'Home', children: <HomeTab /> },
        { key: 'leave', label: 'Leave', children: <EmployeePortalLeaveTab /> },
        {
          key: 'claims',
          label: 'Claims',
          children: <NotSpecifiedTab title="Claims" tickets={['MOVE-3776', 'MOVE-3943', 'MOVE-3945', 'MOVE-3958', 'MOVE-3964']} />,
        },
        {
          key: 'payslip',
          label: 'Pay Slip',
          children: <NotSpecifiedTab title="Pay Slip" tickets={['MOVE-3953', 'MOVE-3954']} />,
        },
      ]}
    />
  )
}
