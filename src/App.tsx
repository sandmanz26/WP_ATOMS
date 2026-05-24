import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import CustomerContractsPage from '@/components/contracts/CustomerContractsPage'
import ContractDetailPage from '@/components/contracts/ContractDetailPage'
import EditBasicInformationPage from '@/components/contracts/edit/EditBasicInformationPage'
import EditPricePage from '@/components/contracts/edit/EditPricePage'
import EditGroupPage from '@/components/contracts/edit/EditGroupPage'

export type AppPage =
  | { type: 'listing' }
  | { type: 'detail'; contractId: string }
  | { type: 'edit-basic'; contractId: string }
  | { type: 'edit-price'; contractId: string }
  | { type: 'edit-group'; contractId: string }

export default function App() {
  const [page, setPage] = useState<AppPage>({ type: 'listing' })
  const navigate = (p: AppPage) => setPage(p)
  const goBack = () => setPage({ type: 'listing' })

  if (page.type === 'detail') return <ContractDetailPage contractId={page.contractId} onNavigate={navigate} onBack={goBack} />
  if (page.type === 'edit-basic') return <EditBasicInformationPage contractId={page.contractId} onBack={goBack} />
  if (page.type === 'edit-price') return <EditPricePage contractId={page.contractId} onBack={goBack} />
  if (page.type === 'edit-group') return <EditGroupPage contractId={page.contractId} onBack={goBack} />

  return (
    <AppLayout>
      <CustomerContractsPage onNavigate={navigate} />
    </AppLayout>
  )
}
