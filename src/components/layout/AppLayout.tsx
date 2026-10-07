import { useState } from 'react'
import { Layout, Menu, Avatar, Typography } from 'antd'
import {
  AppstoreOutlined,
  CalendarOutlined,
  DownOutlined,
  HomeOutlined,
  IdcardOutlined,
  SolutionOutlined,
  UpOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import type { AppPage } from '@/App'
import { version as appVersion } from '../../../package.json'

const { Sider, Content } = Layout
const { Text, Title } = Typography

/**
 * Sidebar collapse toggle — matches the reference sidebar's header icon
 * exactly (two panels inside a rounded frame), not one of AntD's stock
 * icons, so this is a small purpose-built SVG rather than an approximation.
 */
function SidebarToggleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  )
}

/**
 * A sub-item of an expanded section. Read directly off the "Side Navbar"
 * business component (Figma node 425:16539): each sub-item is its own fully
 * rounded row (`itemBorderRadius` 8px on every corner, not just the group's
 * outer edges) on a faint `submenuitembg` tint (`rgba(0,0,0,0.02)`), indented
 * to `pl-[48px]` — double a top-level item's own `paddingLg` (24px) indent —
 * with the same `itemMarginBlock` (4px) gap between rows as everywhere else
 * in the menu. Earlier this joined sub-items into one seamless block with
 * radius only at the group's ends and no gap between rows, which is not what
 * the component actually specifies — that reading is why the spacing looked
 * off next to the real thing.
 */
function groupedSubItem(key: string, label: string, onClick: () => void) {
  return {
    key,
    label: <Text style={{ fontSize: 13, paddingLeft: 24 }}>{label}</Text>,
    onClick,
    style: {
      background: 'rgba(0,0,0,0.02)',
      borderRadius: 8,
    },
  }
}

interface AppLayoutProps {
  children: React.ReactNode
  activeKey?: string
  breadcrumbLabel?: string
  breadcrumbItems?: string[]
  /**
   * The large bold heading every page's header carries below its breadcrumb
   * (reference: a plain listing page like Roster, whose breadcrumb reads
   * "Roster" but whose title reads "Operations Roster" — the sidebar
   * section name prefixed onto the page name). Left unset on pages with
   * their own bespoke, dynamic detail header (a record's name/number, often
   * beside a status tag or actions) — those are a different shape entirely,
   * not a page-listing header, so they keep rendering their own title inline.
   */
  pageTitle?: React.ReactNode
  topBarRight?: React.ReactNode
  onNavigate?: (page: AppPage) => void
}

export default function AppLayout({
  children,
  activeKey = 'live-tracking-testing-2',
  breadcrumbLabel = 'Live Tracking 2.0',
  breadcrumbItems,
  pageTitle,
  topBarRight,
  onNavigate,
}: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [salesOpen, setSalesOpen] = useState(true)
  const [operationsOpen, setOperationsOpen] = useState(true)

  const menuItems = [
    // MOVE-1975 — Leave is its own top-level destination rather than a child of
    // Operations: the listing is HR's, covering every department, and sitting
    // it under Operations would have implied it was scoped to that one.
    {
      key: 'leave',
      icon: <SolutionOutlined style={{ fontSize: 16, color: '#595959' }} />,
      label: <span>Leave</span>,
      onClick: () => onNavigate?.({ type: 'leave' }),
    },
    // MOVE-4021 — HR's Claims module, top-level for the same reason as Leave:
    // it covers every department's claims.
    {
      key: 'claims',
      icon: <WalletOutlined style={{ fontSize: 16, color: '#595959' }} />,
      label: <span>Claims</span>,
      onClick: () => onNavigate?.({ type: 'claims' }),
    },
    // MOVE-3412 — its own top-level destination, same reasoning as Leave
    // above: it is the employee's own dashboard, not scoped under any one
    // department's section.
    {
      key: 'personal-dashboard',
      icon: <IdcardOutlined style={{ fontSize: 16, color: '#595959' }} />,
      label: <span>Personal Dashboard</span>,
      onClick: () => onNavigate?.({ type: 'personal-dashboard' }),
    },
    {
      key: 'operations-header',
      icon: <CalendarOutlined style={{ fontSize: 16, color: '#595959' }} />,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Operations</span>
          {/* Reference convention: chevron points down while collapsed (the
              direction it will open), up while expanded — the opposite of
              this menu's previous own left/right-pointing arrow. */}
          {operationsOpen ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
        </div>
      ),
      onClick: () => setOperationsOpen(!operationsOpen),
    },
    ...(operationsOpen
      ? [
          // 27 Aug review — Roster 3.0 is off the menu so it cannot be mistaken
          // for the live design. Roster 4.0 is the one that matches the PRD;
          // the 3.0 page stays in the code (and on its route) as a prior
          // exploration, just not as something a reviewer can wander into.
          groupedSubItem('roster', 'Roster Calendar', () => onNavigate?.({ type: 'roster' })),
          groupedSubItem('roster-4', 'Roster 4.0', () => onNavigate?.({ type: 'roster-4' })),
        ]
      : []),
    {
      key: 'sales-module-header',
      icon: <AppstoreOutlined style={{ fontSize: 16, color: '#595959' }} />,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Sales Module</span>
          {salesOpen ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
        </div>
      ),
      onClick: () => setSalesOpen(!salesOpen),
    },
    ...(salesOpen
      ? [
          groupedSubItem('live-tracking-testing-2', 'Live Tracking 2.0', () => onNavigate?.({ type: 'live-tracking-testing-2' })),
          groupedSubItem('invoice', 'Invoice', () => onNavigate?.({ type: 'invoice' })),
          groupedSubItem('invoice-testing-2', 'Invoice 2.0', () => onNavigate?.({ type: 'invoice-testing-2' })),
          groupedSubItem('customer-notification', 'Customer Notification', () => onNavigate?.({ type: 'customer-notification' })),
        ]
      : []),
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={250}
        collapsed={collapsed}
        trigger={null}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            gap: 10,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: '4px solid #1677ff',
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            />
            {!collapsed && (
              <Text strong style={{ fontSize: 14 }}>Company</Text>
            )}
          </div>
          {/* Reference moves the collapse trigger up here as an icon button,
              in place of Sider's own default bottom-fixed trigger bar
              (disabled below via `trigger={null}`). Stays visible collapsed
              too, else there would be no way back to the expanded state. */}
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{ cursor: 'pointer', color: '#8c8c8c', display: 'flex', flexShrink: 0 }}
          >
            <SidebarToggleIcon />
          </div>
        </div>

        {/* User */}
        <div
          style={{
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar
              size={32}
              style={{ background: '#bfbfbf', fontSize: 13, fontWeight: 600 }}
            >
              HE
            </Avatar>
            {/* Size/position straight off the Side Navbar component's own
                Badge/Basic "dot" variant on the 32px avatar: 6px, sitting on
                the top edge and just past the right edge. */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: -2,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ff4d4f',
              }}
            />
          </div>
          {!collapsed && (
            <Text style={{ fontSize: 13, color: '#1a1a1a' }}>Heikke Ekkieh</Text>
          )}
        </div>

        {/* Nav */}
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          style={{ border: 'none', marginTop: 4 }}
          items={menuItems.map((item) => ({
            key: item.key,
            icon: (item as { icon?: React.ReactNode }).icon,
            label: item.label,
            onClick: (item as { onClick?: () => void }).onClick,
            style: {
              // `itemBorderRadius` (8px) and `itemMarginBlock` (4px, split as
              // 2px top + 2px bottom so adjacent rows land on 4px between
              // them) straight off the Side Navbar component.
              borderRadius: 8,
              margin: '2px 8px',
              width: 'calc(100% - 16px)',
              ...(item as { style?: React.CSSProperties }).style,
            },
          }))}
        />

      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 250, transition: 'margin-left 0.2s' }}>
        {/* Page header — every page carries the same shape: a small
            breadcrumb trail, then (when `pageTitle` is set) a large bold
            title directly beneath it. Pages with their own dynamic detail
            header (a record's name/number, often beside a status tag or
            actions — a different shape entirely) leave `pageTitle` unset and
            keep rendering their own title inline; this block then holds only
            the breadcrumb, exactly as it always has. */}
        <div
          style={{
            padding: pageTitle ? '20px 32px 24px' : '0 32px',
            height: pageTitle ? undefined : 48,
            background: '#f5f5f5',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: pageTitle ? undefined : '100%',
              marginBottom: pageTitle ? 12 : 0,
            }}
          >
            {/* The trail is rooted in a home icon, matching the target design. */}
            <Text style={{ fontSize: 13, color: '#8c8c8c', display: 'inline-flex', alignItems: 'center' }}>
              <HomeOutlined style={{ marginRight: 4 }} />
              {breadcrumbItems
                ? breadcrumbItems.map((item, i) => (
                    <span key={i}>{i === 0 ? ' / ' : ' / '}{item}</span>
                  ))
                : ` / ${breadcrumbLabel}`}
            </Text>
            {topBarRight ?? <Text style={{ fontSize: 12, color: '#bfbfbf' }}>v{appVersion}</Text>}
          </div>
          {pageTitle && (
            <Title level={2} style={{ margin: 0, fontWeight: 700, fontSize: 28 }}>{pageTitle}</Title>
          )}
        </div>

        <Content style={{ background: '#f5f5f5' }}>{children}</Content>
      </Layout>
    </Layout>
  )
}
