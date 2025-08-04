import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export interface ChoicesResponse {
  materialChoices: MaterialChoice[] | undefined
}

export interface MaterialChoice {
  MaterialChoiceId: string
  RoomType: string
  Caption: string
  ShortDescription: string
  ApartmentId: string
}

export const useCommittedChoices = (apartmentId: string) => {
  return useQuery<ChoicesResponse, AxiosError>({
    queryKey: ['apartmentCommittedChoices', apartmentId],
    queryFn: async () => {
      const { data } = await axios.get<{ content: ChoicesResponse }>(
        `${backendUrl}/rentalproperties/${apartmentId}/material-choices`,
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
