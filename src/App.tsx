import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import CustomerContractsPage from '@/components/contracts/CustomerContractsPage'
import ContractDetailPage from '@/components/contracts/ContractDetailPage'
import EditBasicInformationPage from '@/components/contracts/edit/EditBasicInformationPage'
import EditPricePage from '@/components/contracts/edit/EditPricePage'
import EditGroupPage from '@/components/contracts/edit/EditGroupPage'
import LiveTrackingPage from '@/components/livetracking/LiveTrackingPage'
import Tracking2Page from '@/components/livetracking/Tracking2Page'

export type AppPage =
  | { type: 'listing' }
  | { type: 'detail'; contractId: string }
  | { type: 'edit-basic'; contractId: string }
  | { type: 'edit-price'; contractId: string }
  | { type: 'edit-group'; contractId: string }
  | { type: 'live-tracking' }
  | { type: 'tracking-2' }

export default function App() {
  const [page, setPage] = useState<AppPage>({ type: 'listing' })
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

  if (page.type === 'tracking-2') {
    return (
      <AppLayout activeKey="tracking-2" breadcrumbLabel="Tracking 2.0" onNavigate={navigate}>
        <Tracking2Page />
      </AppLayout>
    )
  }

  return (
    <AppLayout activeKey="customer-contracts" breadcrumbLabel="Customer Contracts" onNavigate={navigate}>
      <CustomerContractsPage onNavigate={navigate} />
    </AppLayout>
  )
}
