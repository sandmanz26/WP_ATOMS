import { useState } from 'react'
import { Layout, Menu, Avatar, Typography } from 'antd'
import {
  EnvironmentOutlined,
  AppstoreOutlined,
  DownOutlined,
  RightOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import type { AppPage } from '@/App'
import { version as appVersion } from '../../../package.json'

const { Sider, Content } = Layout
const { Text } = Typography

interface AppLayoutProps {
  children: React.ReactNode
  activeKey?: string
  breadcrumbLabel?: string
  breadcrumbItems?: string[]
  topBarRight?: React.ReactNode
  onNavigate?: (page: AppPage) => void
}

export default function AppLayout({
  children,
  activeKey = 'live-tracking-testing-2',
  breadcrumbLabel = 'Live Tracking 2.0',
  breadcrumbItems,
  topBarRight,
  onNavigate,
}: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [salesOpen, setSalesOpen] = useState(true)

  const menuItems = [
    {
      key: 'sales-module-header',
      icon: <AppstoreOutlined style={{ fontSize: 16, color: '#595959' }} />,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Sales Module</span>
          {salesOpen ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
        </div>
      ),
      onClick: () => setSalesOpen(!salesOpen),
    },
    ...(salesOpen
      ? [
          {
            key: 'live-tracking-testing-2',
            label: (
              <Text style={{ fontSize: 13, paddingLeft: 8 }}>Live Tracking 2.0</Text>
            ),
            onClick: () => onNavigate?.({ type: 'live-tracking-testing-2' }),
          },
          {
            key: 'invoice',
            label: (
              <Text style={{ fontSize: 13, paddingLeft: 8 }}>Invoice</Text>
            ),
            onClick: () => onNavigate?.({ type: 'invoice' }),
          },
        ]
      : []),
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
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
            gap: 10,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#1677ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>C</span>
          </div>
          {!collapsed && (
            <Text strong style={{ fontSize: 14 }}>Company</Text>
          )}
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
          <Avatar
            size={32}
            style={{ background: '#597ef7', fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >
            HE
          </Avatar>
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
            icon: item.icon,
            label: item.label,
            onClick: (item as { onClick?: () => void }).onClick,
            style: { borderRadius: 6, margin: '1px 8px', width: 'calc(100% - 16px)' },
          }))}
        />

        {/* Active section highlight */}
        <div
          style={{
            margin: '4px 8px',
            padding: '8px 12px',
            borderRadius: 6,
            background: '#e6f4ff',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {activeKey === 'invoice' ? (
            <FileTextOutlined style={{ color: '#1677ff', fontSize: 14 }} />
          ) : (
            <EnvironmentOutlined style={{ color: '#1677ff', fontSize: 14 }} />
          )}
          {!collapsed && (
            <Text style={{ fontSize: 13, color: '#1677ff', fontWeight: 500 }}>
              {breadcrumbLabel}
            </Text>
          )}
        </div>
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        {/* Top breadcrumb */}
        <div
          style={{
            padding: '0 32px',
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            background: '#fff',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Text style={{ fontSize: 13, color: '#8c8c8c' }}>
            {breadcrumbItems
              ? breadcrumbItems.map((item, i) => (
                  <span key={i}>{i === 0 ? '/ ' : ' / '}{item}</span>
                ))
              : `/ ${breadcrumbLabel}`}
          </Text>
          {topBarRight ?? <Text style={{ fontSize: 12, color: '#bfbfbf' }}>v{appVersion}</Text>}
        </div>

        <Content style={{ background: '#f5f5f5' }}>{children}</Content>
      </Layout>
    </Layout>
  )
}
