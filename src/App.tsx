import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import CustomerContractsPage from '@/components/contracts/CustomerContractsPage'
import ContractDetailPage from '@/components/contracts/ContractDetailPage'
import EditBasicInformationPage from '@/components/contracts/edit/EditBasicInformationPage'
import EditPricePage from '@/components/contracts/edit/EditPricePage'
import EditGroupPage from '@/components/contracts/edit/EditGroupPage'
import LiveTrackingPage from '@/components/livetracking/LiveTrackingPage'
import LiveTrackingLegacyPage from '@/components/livetracking/LiveTrackingLegacyPage'
import LiveTrackingTestingPage from '@/components/livetracking/LiveTrackingTestingPage'
import LiveTrackingTesting2Page from '@/components/livetracking/LiveTrackingTesting2Page'
import Tracking2Page from '@/components/livetracking/Tracking2Page'
import TestingPage from '@/components/testing/TestingPage'
import InvoicePage from '@/components/invoice/InvoicePage'
import InvoiceDetailPage from '@/components/invoice/InvoiceDetailPage'
import InvoiceTesting2Page from '@/components/invoice/InvoiceTesting2Page'
import InvoiceDetailTesting2Page from '@/components/invoice/InvoiceDetailTesting2Page'
import NotificationPage from '@/components/sales-module/NotificationPage'
import CustomerNotificationPage from '@/components/notification/CustomerNotificationPage'
import CustomerNotificationDetailPage from '@/components/notification/CustomerNotificationDetailPage'
import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'

export type AppPage =
  | { type: 'listing' }
  | { type: 'detail'; contractId: string }
  | { type: 'edit-basic'; contractId: string }
  | { type: 'edit-price'; contractId: string }
  | { type: 'edit-group'; contractId: string }
  | { type: 'live-tracking' }
  | { type: 'live-tracking-legacy' }
  | { type: 'live-tracking-testing' }
  | { type: 'live-tracking-testing-2' }
  | { type: 'tracking-2' }
  | { type: 'testing' }
  | { type: 'invoice' }
  | { type: 'invoice-detail'; invoiceId: string }
  | { type: 'invoice-testing-2' }
  | { type: 'invoice-detail-testing-2'; invoiceId: string }
  | { type: 'notification' }
  | { type: 'customer-notification' }
  | { type: 'customer-notification-detail'; notificationId: string }

export default function App() {
  const [page, setPage] = useState<AppPage>({ type: 'live-tracking-testing-2' })
  const navigate = (p: AppPage) => setPage(p)
  const goBack = () => setPage({ type: 'listing' })

  // PRD §9.2/§17 — "Return to Listing" must be hidden while the Customer
  // Notification detail page is in a multi-select mode (Email/SMS/Mark as
  // Not Required). That mode lives inside the page component, but this
  // button is rendered by AppLayout at the App level, so the page reports
  // its mode up via this callback.
  const [notifSelectModeActive, setNotifSelectModeActive] = useState(false)

  if (page.type === 'detail') return <ContractDetailPage contractId={page.contractId} onNavigate={navigate} onBack={goBack} />
  if (page.type === 'edit-basic') return <EditBasicInformationPage contractId={page.contractId} onBack={goBack} />
  if (page.type === 'edit-price') return <EditPricePage contractId={page.contractId} onBack={goBack} />
  if (page.type === 'edit-group') return <EditGroupPage contractId={page.contractId} onBack={goBack} />

  if (page.type === 'live-tracking') {
    return (
      <AppLayout activeKey="live-tracking" breadcrumbLabel="Live Tracking" onNavigate={navigate}>
        <LiveTrackingPage />
      </AppLayout>
    )
  }

  if (page.type === 'live-tracking-legacy') {
    return (
      <AppLayout activeKey="live-tracking-legacy" breadcrumbLabel="Live Tracking Legacy" onNavigate={navigate}>
        <LiveTrackingLegacyPage />
      </AppLayout>
    )
  }

  if (page.type === 'live-tracking-testing') {
    return (
      <AppLayout activeKey="live-tracking-testing" breadcrumbLabel="Live Tracking Testing" onNavigate={navigate}>
        <LiveTrackingTestingPage />
      </AppLayout>
    )
  }

  if (page.type === 'live-tracking-testing-2') {
    return (
      <AppLayout activeKey="live-tracking-testing-2" breadcrumbLabel="Live Tracking Testing 2" onNavigate={navigate}>
        <LiveTrackingTesting2Page />
      </AppLayout>
    )
  }

  if (page.type === 'tracking-2') {
    return (
      <AppLayout activeKey="tracking-2" breadcrumbLabel="Tracking 2.0" onNavigate={navigate}>
        <Tracking2Page />
      </AppLayout>
    )
  }

  if (page.type === 'testing') {
    return (
      <AppLayout activeKey="testing" breadcrumbLabel="Testing" onNavigate={navigate}>
        <TestingPage />
      </AppLayout>
    )
  }

  if (page.type === 'invoice') {
    return (
      <AppLayout activeKey="invoice" breadcrumbLabel="Invoice" onNavigate={navigate}>
        <InvoicePage onNavigate={navigate} />
      </AppLayout>
    )
  }

  if (page.type === 'invoice-detail') {
    return (
      <AppLayout
        activeKey="invoice"
        breadcrumbItems={['Invoice', 'Invoice Detail']}
        topBarRight={
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate({ type: 'invoice' })}
            style={{ borderRadius: 6 }}
          >
            Return to Invoice
          </Button>
        }
        onNavigate={navigate}
      >
        <InvoiceDetailPage invoiceId={page.invoiceId} onBack={() => navigate({ type: 'invoice' })} />
      </AppLayout>
    )
  }

  if (page.type === 'invoice-testing-2') {
    return (
      <AppLayout activeKey="invoice-testing-2" breadcrumbLabel="Invoice 2.0" onNavigate={navigate}>
        <InvoiceTesting2Page onNavigate={navigate} />
      </AppLayout>
    )
  }

  if (page.type === 'invoice-detail-testing-2') {
    return (
      <AppLayout
        activeKey="invoice-testing-2"
        breadcrumbItems={['Invoice 2.0', 'Invoice Detail']}
        topBarRight={
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate({ type: 'invoice-testing-2' })}
            style={{ borderRadius: 6 }}
          >
            Return to Invoice
          </Button>
        }
        onNavigate={navigate}
      >
        <InvoiceDetailTesting2Page invoiceId={page.invoiceId} onBack={() => navigate({ type: 'invoice-testing-2' })} />
      </AppLayout>
    )
  }

  if (page.type === 'notification') {
    return (
      <AppLayout activeKey="notification" breadcrumbLabel="Notifications" onNavigate={navigate}>
        <NotificationPage />
      </AppLayout>
    )
  }

  if (page.type === 'customer-notification') {
    return (
      <AppLayout activeKey="customer-notification" breadcrumbLabel="Customer Notification" onNavigate={navigate}>
        <CustomerNotificationPage onNavigate={navigate} />
      </AppLayout>
    )
  }

  if (page.type === 'customer-notification-detail') {
    return (
      <AppLayout
        activeKey="customer-notification"
        breadcrumbItems={['Customer Notification', 'Notification Details']}
        topBarRight={
          notifSelectModeActive ? <></> : (
            <Button
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate({ type: 'customer-notification' })}
              style={{ borderRadius: 6 }}
            >
              Return to Listing
            </Button>
          )
        }
        onNavigate={navigate}
      >
        <CustomerNotificationDetailPage
          notificationId={page.notificationId}
          onBack={() => navigate({ type: 'customer-notification' })}
          onSelectModeChange={setNotifSelectModeActive}
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout activeKey="customer-contracts" breadcrumbLabel="Customer Contracts" onNavigate={navigate}>
      <CustomerContractsPage onNavigate={navigate} />
    </AppLayout>
  )
}
