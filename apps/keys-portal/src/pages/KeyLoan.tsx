import { useState, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchTenant } from '@/components/loan/SearchTenant'
import { SearchPropertyId } from '@/components/loan/SearchPropertyId'
import { TenantInfo } from '@/components/loan/TenantInfo'
import type { Tenant, Lease } from '@/services/types'

export default function KeyLoan() {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [tenantContracts, setTenantContracts] = useState<Lease[]>([])
  const [showTenantCard, setShowTenantCard] = useState<boolean>(true) // NEW
  const resultsRef = useRef<HTMLDivElement | null>(null)

  const scrollToResults = () =>
    setTimeout(
      () => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }),
      100
    )

  // PNR flow
  const handlePnrFound = (tenant: Tenant, contracts: Lease[]) => {
    setSelectedTenant(tenant)
    setTenantContracts(contracts)
    setShowTenantCard(true)
    scrollToResults()
  }

  // Property flow
  const handlePropertyFound = (_tenant: Tenant | null, contracts: Lease[]) => {
    setSelectedTenant(null) // no tenant header
    setTenantContracts(contracts)
    setShowTenantCard(false)
    scrollToResults()
  }

  const handleClearSearch = () => {
    setSelectedTenant(null)
    setTenantContracts([])
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* … header omitted for brevity … */}

      <div className="max-w-2xl mx-auto">
        <Tabs defaultValue="personnummer" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="personnummer">Personnummer</TabsTrigger>
            <TabsTrigger value="hyresobjekt">Hyresobjekt</TabsTrigger>
          </TabsList>

          <TabsContent value="personnummer" className="space-y-4">
            <SearchTenant onTenantFound={handlePnrFound} />
          </TabsContent>

          <TabsContent value="hyresobjekt" className="space-y-4">
            <SearchPropertyId onTenantFound={handlePropertyFound} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Show results even when tenant is null (property search) */}
      {tenantContracts.length > 0 && (
        <div ref={resultsRef} className="border-t pt-8">
          <TenantInfo
            tenant={selectedTenant}
            contracts={tenantContracts}
            onClearSearch={handleClearSearch}
            showTenantCard={showTenantCard} // ← key line
          />
        </div>
      )}
    </div>
  )
}
