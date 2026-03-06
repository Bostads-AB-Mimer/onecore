import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

const DEBOUNCE_DELAY = 300 // ms

export const useValidateRentalObject = (rentalObjectCode: string | null) => {
  const [debouncedCode, setDebouncedCode] = useState(rentalObjectCode)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCode(rentalObjectCode)
    }, DEBOUNCE_DELAY)

    return () => clearTimeout(timer)
  }, [rentalObjectCode])

  return useQuery<boolean, AxiosError>({
    queryKey: ['validate-rental-object', debouncedCode],
    enabled: Boolean(debouncedCode && debouncedCode.trim().length > 0),
    queryFn: async () => {
      try {
        await axios.get(
          `${backendUrl}/rental-objects/by-code/${debouncedCode}`,
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
}
