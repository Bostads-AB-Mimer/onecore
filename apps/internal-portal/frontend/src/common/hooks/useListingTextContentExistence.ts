import { useCallback, useMemo } from 'react'
import { AxiosError } from 'axios'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import apiClient from '../../utils/api-client'
import { ListingTextContentExistence } from '../../components'

const fetchExistingCodes = (rentalObjectCodes: string[]): Promise<string[]> =>
  apiClient
    .post<{ content: string[] }>('/listing-text-content/existence', {
      rentalObjectCodes,
    })
    // Return a plain array so react-query's structural sharing keeps the
    // data identity stable across refetches that yield the same result.
    .then((res) => res.data.content)

// Bulk existence check: which of the given rental object codes have listing
// text content ("annonsinnehåll"). Used by the parking space tables to decide
// whether a row's icon should link to the edit or the create view.
//
// Keyed under the 'listingTextContent' prefix so the editor's create/update/
// delete mutations (which invalidate that prefix) also refresh this query.
export const useListingTextContentExistence = (
  rentalObjectCodes: string[]
): ListingTextContentExistence => {
  const sortedCodes = useMemo(
    () => Array.from(new Set(rentalObjectCodes)).sort(),
    [rentalObjectCodes]
  )

  const query = useQuery<string[], AxiosError>({
    queryKey: ['listingTextContent', 'existence', sortedCodes],
    queryFn: () => fetchExistingCodes(sortedCodes),
    enabled: sortedCodes.length > 0,
    // Keep the previous answer while a changed code list (tab switch,
    // listing refetch) is loading so icons don't flip to disabled meanwhile.
    placeholderData: keepPreviousData,
    retry: (failureCount: number, error: AxiosError) =>
      error.response?.status !== 401 && failureCount < 3,
  })

  const existingCodes = useMemo(
    () => (query.data ? new Set(query.data) : undefined),
    [query.data]
  )

  // undefined while the existence is unknown (loading or error). Stable
  // identity so consumers can use it as a useMemo/useCallback dependency.
  const hasTextContent = useCallback(
    (rentalObjectCode: string): boolean | undefined =>
      existingCodes?.has(rentalObjectCode),
    [existingCodes]
  )

  const isError = query.isError
  return useMemo(() => ({ hasTextContent, isError }), [hasTextContent, isError])
}
