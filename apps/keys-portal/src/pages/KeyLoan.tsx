import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUnifiedSearch } from '@/components/loan/UnifiedSearch'
import { SearchInput } from '@/components/loan/SearchInput'
import { TenantInfo } from '@/components/loan/TenantInfo'
import type { Tenant, Lease } from '@/services/types'

export default function KeyLoan() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [tenantContracts, setTenantContracts] = useState<Lease[]>([])
  const [showTenantCard, setShowTenantCard] = useState<boolean>(true)
  const [searchType, setSearchType] = useState<
    'pnr' | 'object' | 'contactCode' | null
  >(null)
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
    setSearchType(type)

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
    setSearchType(null)
    setSearchParams({})
  }

  const {
    searchValue,
    setSearchValue,
    handleSearch,
    handleSelectResult,
    loading,
  } = useUnifiedSearch({
    onResultFound: handleResultFound,
  })

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="max-w-2xl mx-auto">
        <SearchInput
          value={searchValue}
          onChange={setSearchValue}
          onSearch={handleSearch}
          onSelect={handleSelectResult}
          loading={loading}
          placeholder="Personnummer, kundnummer, hyresobjekt eller adress"
          title="Sök hyresgäst eller hyresobjekt"
          description="Sök på personnummer, kundnummer, hyresobjekt eller adress"
          helpText={
            <>
              <p>Personnummer: YYYYMMDD-XXXX (t.ex. 19850315-1234)</p>
              <p>
                Kundnummer: PXXXXXX eller FXXXXXX (t.ex. P053602 eller F123456)
              </p>
              <p>Hyresobjekt: XXX-XXX-XX-XXX (t.ex. 705-011-03-1234)</p>
            </>
          }
        />
      </div>

      {/* Show results even when tenant is null (property search) */}
      {tenantContracts.length > 0 && (
        <div ref={resultsRef} className="border-t pt-8">
          <TenantInfo
            tenant={selectedTenant}
            contracts={tenantContracts}
            onClearSearch={handleClearSearch}
            showTenantCard={showTenantCard}
            searchType={searchType}
          />
        </div>
      )}
    </div>
  )
}
