import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { tenantService } from '@/services/api/core'
import type { ContactSearchResult } from '@/services/api/core/tenantService'

export interface TenantSearchResult {
  fullName: string
  contactCode: string
}

export const useTenantSearch = () => {
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch contacts search results
  const contactsSearchQuery = useQuery({
    queryKey: ['contacts-search', searchQuery],
    queryFn: async () => {
      return await tenantService.searchContacts(searchQuery)
    },
    enabled: searchQuery.trim().length >= 3,
  })

  // Convert API results to TenantSearchResult format
  const searchResults = useMemo((): TenantSearchResult[] => {
    if (contactsSearchQuery.data) {
      return contactsSearchQuery.data.map((contact: ContactSearchResult) => ({
        fullName: contact.fullName,
        contactCode: contact.contactCode,
      }))
    }

    return []
  }, [contactsSearchQuery.data])

  const showSearchResults = searchQuery.trim().length >= 3
  const isSearching = contactsSearchQuery.isLoading

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    showSearchResults,
    isSearching,
  }
}
