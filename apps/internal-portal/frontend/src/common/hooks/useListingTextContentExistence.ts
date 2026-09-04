import { useCallback, useMemo } from 'react'
import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

// The backend caps each existence request at 1000 codes
const MAX_CODES_PER_REQUEST = 1000

const fetchExistingCodes = (rentalObjectCodes: string[]): Promise<string[]> =>
  axios
    .post<{ content: string[] }>(
      `${backendUrl}/listing-text-content/existence`,
      { rentalObjectCodes },
      {
        headers: {
          Accept: 'application/json',
          'Access-Control-Allow-Credentials': true,
        },
        withCredentials: true,
      }
    )
    .then((res) => res.data.content)

// Bulk existence check: which of the given rental object codes have listing
// text content ("annonsinnehåll"). Used by the parking space tables to decide
// whether a row's icon should link to the edit or the create view.
//
// Keyed under the 'listingTextContent' prefix so the editor's create/update/
// delete mutations (which invalidate that prefix) also refresh this query.
export const useListingTextContentExistence = (rentalObjectCodes: string[]) => {
  const sortedCodes = useMemo(
    () => Array.from(new Set(rentalObjectCodes)).sort(),
    [rentalObjectCodes]
  )

  const query = useQuery<Set<string>, AxiosError>({
    queryKey: ['listingTextContent', 'existence', sortedCodes],
    queryFn: async () => {
      const chunks: string[][] = []
      for (let i = 0; i < sortedCodes.length; i += MAX_CODES_PER_REQUEST) {
        chunks.push(sortedCodes.slice(i, i + MAX_CODES_PER_REQUEST))
      }
      const results = await Promise.all(chunks.map(fetchExistingCodes))
      return new Set(results.flat())
    },
    enabled: sortedCodes.length > 0,
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })

  // undefined while the existence is unknown (loading or error). Stable
  // identity so consumers can use it as a useMemo/useCallback dependency.
  const existingCodes = query.data
  const hasTextContent = useCallback(
    (rentalObjectCode: string): boolean | undefined =>
      existingCodes?.has(rentalObjectCode),
    [existingCodes]
  )

  return { ...query, hasTextContent }
}
