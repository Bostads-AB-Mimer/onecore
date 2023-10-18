import axios, { AxiosError } from 'axios'
import { useQuery } from 'react-query'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export interface ChoicesResponse {
  materialChoices: MaterialChoice[] | undefined;
}

export interface MaterialChoice {
  materialChoiceId: string;
  roomType: string;
  caption: string;
  shortDescription: string;
  apartmentId: string;
}

export const useCommittedChoices = (apartmentId: string) => {
  return useQuery<ChoicesResponse, AxiosError>({
    queryKey: ['apartmentCommittedChoices', apartmentId],
    queryFn: async () => {
      const { data } = await axios.get<ChoicesResponse>(
        `${backendUrl}/rentalproperties/${apartmentId}/material-choices`,
        {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        }
      )

      return data
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