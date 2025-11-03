import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export const useValidateRentalObject = (rentalObjectCode: string | null) =>
  useQuery<boolean, AxiosError>({
    queryKey: ['validate-rental-object', rentalObjectCode],
    enabled: Boolean(rentalObjectCode && rentalObjectCode.trim().length > 0),
    queryFn: async () => {
      try {
        await axios.get(
          `${backendUrl}/rental-objects/by-code/${rentalObjectCode}`,
          {
            headers: {
              Accept: 'application/json',
              'Access-Control-Allow-Credentials': true,
            },
            withCredentials: true,
          }
        )
        return true
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 404) {
          return false
        }
        throw err
      }
    },
    retry: false,
    staleTime: 30000, // Cache for 30 seconds
  })
