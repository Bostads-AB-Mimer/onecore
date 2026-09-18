import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { property } from '@onecore/types'
import { z } from 'zod'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

type MarketArea = z.infer<typeof property.MarketAreaSchema>

// GET - Fetch all market areas
export const useMarketAreas = () =>
  useQuery<MarketArea[], AxiosError>({
    queryKey: ['marketAreas'],
    queryFn: () =>
      axios
        .get(`${backendUrl}/market-areas`, {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        })
        .then((res) => res.data.content),
  })
