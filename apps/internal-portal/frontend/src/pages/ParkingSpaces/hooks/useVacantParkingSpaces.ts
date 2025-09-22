import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { RentalObject } from '@onecore/types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export const useVacantParkingSpaces = () =>
  useQuery<Array<RentalObject>, AxiosError>({
    queryKey: ['vacantParkingSpaces'],
    queryFn: () =>
      axios
        .get(`${backendUrl}/rental-objects/vacant-parkingspaces`, {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        })
        .then((res) => res.data.content),
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })
