import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import {
  fetchTenantAndLeasesByPnr,
  fetchLeasesByRentalPropertyId,
  fetchTenantAndLeasesByContactCode,
} from '@/services/api/leaseSearchService'
import type { Lease, Tenant } from '@/services/types'

interface UnifiedSearchProps {
  onResultFound: (
    tenant: Tenant | null,
    contracts: Lease[],
    searchValue: string,
    type: 'pnr' | 'object' | 'contactCode'
  ) => void
}

const isValidPnr = (value: string) =>
  /^(?:\d{6}|\d{8})-?\d{4}$/.test(value.trim())

const isContactCode = (value: string) => {
  const trimmed = value.trim().toUpperCase()
  // Contact codes start with P or F and contain only letters/numbers (no dashes or spaces)
  return /^[PF][A-Z0-9]+$/.test(trimmed) && trimmed.length >= 4
}

const isObjectId = (value: string) => {
  const trimmed = value.trim()
  // Check if there's a dash in the first 5 characters
  const first5 = trimmed.substring(0, 5)
  return first5.includes('-')
}

function pickPrimaryTenant(contracts: Lease[]): Tenant | null {
  const isActive = (l: Lease) =>
    (l.status ?? '').toString().toLowerCase() === 'active'

  // For object searches, only return a tenant if there's an active lease
  const primaryLease = contracts.find(isActive)
  if (!primaryLease) return null

  const t = primaryLease?.tenants?.[0]
  return (t as Tenant) ?? null
}

export function useUnifiedSearch({ onResultFound }: UnifiedSearchProps) {
  const [searchParams] = useSearchParams()
  const [searchValue, setSearchValue] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSearch = async () => {
    const value = searchValue.trim()
    if (!value) {
      toast({
        title: 'Saknar värde',
        description: 'Ange personnummer, kundnummer eller hyresobjekt.',
        variant: 'destructive',
      })
      return
    }

    // Determine search type based on format
    if (isObjectId(value)) {
      await handleSearchByObjectId(value)
    } else if (isValidPnr(value)) {
      await handleSearchByPnr(value)
    } else if (isContactCode(value)) {
      await handleSearchByContactCode(value)
    } else {
      toast({
        title: 'Ogiltigt format',
        description:
          'Ange personnummer (YYYYMMDD-XXXX), kundnummer (PXXXXXX/FXXXXXX) eller hyresobjekt (XXX-XXX-XX-XXX).',
        variant: 'destructive',
      })
    }
  }

  // Trigger search when URL parameters are present
  useEffect(() => {
    const tenantParam = searchParams.get('tenant')
    const objectParam = searchParams.get('object')

    if (tenantParam && isValidPnr(tenantParam)) {
      setSearchValue(tenantParam)
      handleSearchByPnr(tenantParam)
    } else if (tenantParam && isContactCode(tenantParam)) {
      setSearchValue(tenantParam)
      handleSearchByContactCode(tenantParam)
    } else if (objectParam && objectParam.trim()) {
      setSearchValue(objectParam)
      handleSearchByObjectId(objectParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleSearchByPnr = async (pnr: string) => {
    setLoading(true)
    try {
      const result = await fetchTenantAndLeasesByPnr(pnr)
      if (!result) {
        toast({
          title: 'Ingen träff',
          description: 'Hittade ingen hyresgäst för angivet personnummer.',
        })
        return
      }
      onResultFound(result.tenant, result.contracts, pnr, 'pnr')
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : 'Okänt fel'
      toast({
        title: 'Kunde inte söka',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearchByContactCode = async (contactCode: string) => {
    setLoading(true)
    try {
      const result = await fetchTenantAndLeasesByContactCode(contactCode)
      if (!result) {
        toast({
          title: 'Ingen träff',
          description: 'Hittade ingen hyresgäst för angivet kundnummer.',
        })
        return
      }
      onResultFound(result.tenant, result.contracts, contactCode, 'contactCode')
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : 'Okänt fel'
      toast({
        title: 'Kunde inte söka',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearchByObjectId = async (id: string) => {
    setLoading(true)
    try {
      const contracts = await fetchLeasesByRentalPropertyId(id, {
        includeUpcomingLeases: true,
        includeTerminatedLeases: true,
        includeContacts: true,
      })

      if (!contracts.length) {
        toast({
          title: 'Ingen träff',
          description: 'Hittade inga kontrakt för angivet hyresobjekt.',
        })
        return
      }

      const tenant = pickPrimaryTenant(contracts)
      onResultFound(tenant, contracts, id, 'object')
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : 'Okänt fel'
      toast({
        title: 'Kunde inte söka',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return {
    searchValue,
    setSearchValue,
    handleSearch,
    loading,
  }
}
