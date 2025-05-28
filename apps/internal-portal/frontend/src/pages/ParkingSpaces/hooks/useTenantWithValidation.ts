import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Tenant } from 'onecore-types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export type TenantWithValidation = {
  tenant: Tenant
  validationResult:
    | 'ok'
    | 'no-contract'
    | 'needs-replace-by-property'
    | 'needs-replace-by-residential-area'
    | 'has-at-least-one-parking-space'
}

export const useTenantWithValidation = (
  contactCode?: string,
  districtCode?: string,
  rentalObjectCode?: string
) =>
  useQuery<TenantWithValidation, AxiosError>({
    queryKey: [
      'tenant-with-validation',
      contactCode,
      districtCode,
      rentalObjectCode,
    ],
    enabled: Boolean(contactCode && districtCode && rentalObjectCode),
    queryFn: () =>
      axios
        .get(
          `${backendUrl}/contacts/${contactCode}/validate-tentant/${districtCode}/${rentalObjectCode}`,
          {
            headers: {
              Accept: 'application/json',
              'Access-Control-Allow-Credentials': true,
            },
            withCredentials: true,
          }
        )
        .then((res) => res.data),
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })
