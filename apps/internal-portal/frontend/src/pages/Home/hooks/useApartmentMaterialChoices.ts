import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export interface ApartmentChoiceStatus {
  apartmentId: string
  numChoices: number
}

export const useApartmentMaterialChoices = () => {
  return useQuery<ApartmentChoiceStatus[], AxiosError>({
    queryKey: ['apartmentChoices'],
    queryFn: async () => {
      const { data } = await axios.get<{ content: ApartmentChoiceStatus[] }>(
        `${backendUrl}/rentalproperties/material-choice-statuses`,
        {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        }
      )

      return data.content
    },
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
}
