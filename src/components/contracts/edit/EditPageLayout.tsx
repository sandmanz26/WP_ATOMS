import { Button, Typography } from 'antd'
import { TeamOutlined } from '@ant-design/icons'

const { Text } = Typography

interface EditPageLayoutProps {
  title: string
  breadcrumb: string
  onBack: () => void
  onSave: () => void
  saveText?: string
  children: React.ReactNode
}

export default function EditPageLayout({
  title,
  breadcrumb,
  onBack,
  onSave,
  saveText = 'Save',
  children,
}: EditPageLayoutProps) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>

      {/* ── Sidebar ── */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          zIndex: 100,
          overflowY: 'auto',
        }}
      >
        {/* Brand */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>C</span>
          </div>
          <Text strong style={{ fontSize: 14 }}>Company</Text>
        </div>
        {/* User */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#597ef7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>HE</span>
          </div>
          <Text style={{ fontSize: 13 }}>Heikke Ekkieh</Text>
        </div>
        {/* Nav items */}
        {['Notifications', 'Roles & Permissions', 'Tenant', 'Staff', 'Operations'].map((label) => (
          <div key={label} style={{ padding: '8px 20px', fontSize: 13, color: '#595959', cursor: 'pointer', margin: '1px 8px', borderRadius: 6 }}>
            {label}
          </div>
        ))}
        {['Fleet Owners', 'Fleets', 'Drivers'].map((label) => (
          <div key={label} style={{ padding: '8px 32px', fontSize: 13, color: '#595959', cursor: 'pointer' }}>
            {label}
          </div>
        ))}
        {/* Active highlight */}
        <div style={{ margin: '4px 8px', padding: '8px 12px', borderRadius: 6, background: '#e6f4ff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TeamOutlined style={{ color: '#1677ff', fontSize: 14 }} />
          <Text style={{ fontSize: 13, color: '#1677ff', fontWeight: 500 }}>Customer Contracts</Text>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Breadcrumb bar */}
        <div style={{ padding: '0 32px', height: 48, display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
          <Text style={{ fontSize: 13, color: '#8c8c8c' }}>
            <span style={{ cursor: 'pointer' }} onClick={onBack}>Home</span>
            {' / '}
            <span style={{ cursor: 'pointer' }} onClick={onBack}>Customer Contract</span>
            {' / '}
            <span style={{ color: '#1a1a1a' }}>{breadcrumb}</span>
          </Text>
        </div>

        {/* Sticky page header */}
        <div
          style={{
            padding: '16px 32px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 48,
            zIndex: 9,
            borderBottom: '1px solid #e8e8e8',
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>{title}</Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onBack}>Cancel</Button>
            <Button type="primary" onClick={onSave}>{saveText}</Button>
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: '24px 32px', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}
