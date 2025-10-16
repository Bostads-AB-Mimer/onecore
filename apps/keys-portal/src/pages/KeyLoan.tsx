import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UnifiedSearch } from '@/components/loan/UnifiedSearch'
import { TenantInfo } from '@/components/loan/TenantInfo'
import type { Tenant, Lease } from '@/services/types'

export default function KeyLoan() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [tenantContracts, setTenantContracts] = useState<Lease[]>([])
  const [showTenantCard, setShowTenantCard] = useState<boolean>(true)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  const scrollToResults = () =>
    setTimeout(
      () => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }),
      100
    )

  const handleResultFound = (
    tenant: Tenant | null,
    contracts: Lease[],
    searchValue: string,
    type: 'pnr' | 'object' | 'contactCode'
  ) => {
    setSelectedTenant(tenant)
    setTenantContracts(contracts)
    setShowTenantCard(true)

    // Update URL params based on search type
    if (type === 'pnr') {
      setSearchParams({ tenant: searchValue })
    } else if (type === 'contactCode') {
      setSearchParams({ tenant: searchValue })
    } else {
      setSearchParams({ object: searchValue })
    }

    scrollToResults()
  }

  const handleClearSearch = () => {
    setSelectedTenant(null)
    setTenantContracts([])
    setSearchParams({})
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="max-w-2xl mx-auto">
        <UnifiedSearch onResultFound={handleResultFound} />
      </div>

      {/* Show results even when tenant is null (property search) */}
      {tenantContracts.length > 0 && (
        <div ref={resultsRef} className="border-t pt-8">
          <TenantInfo
            tenant={selectedTenant}
            contracts={tenantContracts}
            onClearSearch={handleClearSearch}
            showTenantCard={showTenantCard}
          />
        </div>
      )}
    </div>
  )
}
