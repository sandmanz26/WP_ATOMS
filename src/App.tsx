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

export default function App() {
  const [page, setPage] = useState<AppPage>({ type: 'live-tracking-testing-2' })
  const navigate = (p: AppPage) => setPage(p)
  const goBack = () => setPage({ type: 'listing' })

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

  return (
    <AppLayout activeKey="customer-contracts" breadcrumbLabel="Customer Contracts" onNavigate={navigate}>
      <CustomerContractsPage onNavigate={navigate} />
    </AppLayout>
  )
}
