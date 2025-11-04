import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTenant } from '@/components/hooks/useTenant'
import { TenantCard } from '@/components/tenants/TenantCard'
// import { TenantDetailTabs } from '@/components/tenants/tabs/TenantDetailTabs'
// import { TenantDetailTabsContent } from '@/components/tenants/tabs/TenantDetailTabsContent'

const TenantView = () => {
  const { contactCode } = useParams<{ contactCode: string }>()

  // Fetch tenant data
  const { data: tenant, isLoading, error } = useTenant(contactCode)

  useEffect(() => {
    if (error) {
      console.error('Error loading tenant data:', error)
    }
  }, [error])

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="animate-pulse space-y-6 py-4">
          <div className="h-8 bg-secondary rounded w-64"></div>
          <div className="h-4 bg-secondary rounded w-32 mt-2"></div>
          <div className="h-[200px] bg-secondary rounded mt-6"></div>
        </div>
      )
    }

    if (error || !tenant) {
      return (
        <div className="text-center py-10 space-y-4">
          <h2 className="text-2xl font-bold">Hyresgästen kunde inte hittas</h2>
          <p className="text-muted-foreground">
            Kontrollera kundnummret och försök igen
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Sökte efter: {contactCode}
          </p>
        </div>
      )
    }

    return (
      <div className="py-4 space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Main tenant information card */}
        <TenantCard tenant={tenant} />

        {/* Tabbed content for contracts, queue, cases, etc. - NOT YET READY */}
        {/* <TenantDetailTabs defaultValue="contracts" hasActiveCases={false}>
          <TenantDetailTabsContent
            contracts={tenant.housingContracts || []}
            personalNumber={tenant.nationalRegistrationNumber}
            customerNumber={tenant.contactCode}
            customerName={tenant.fullName}
          />
        </TenantDetailTabs> */}
      </div>
    )
  }

  return renderContent()
}

export default TenantView
