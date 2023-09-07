import axios, { AxiosError } from 'axios'
import { useQuery } from 'react-query'

import { MaterialOption, RoomType } from '../../../common/types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export interface RoomTypesResponse {
  data: {
    roomTypes: Array<RoomType> | undefined
  }
}

export interface MaterialOptionResponse {
  data: {
    materialOption: MaterialOption | undefined
  }
}

export const useMaterialOptions = ({
  apartmentId,
}: {
  apartmentId: string | null
}) =>
  useQuery<RoomTypesResponse, AxiosError>({
    queryKey: ['apartmentId', apartmentId],
    queryFn: async () => {
      if (apartmentId) {
        const { data } = await axios.get<RoomTypesResponse>(
          `${backendUrl}/material-options`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: 'Bearer sometoken',
            },
          }
        )
        return data
      } else {
        return {
          data: {
            roomTypes: undefined,
          },
        }
      }
    },
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })

export const useMaterialChoices = ({ apartmentId }: { apartmentId: string }) =>
  useQuery<RoomTypesResponse, AxiosError>({
    queryKey: ['materialChoices', apartmentId],
    queryFn: async () => {
      if (apartmentId) {
        const { data } = await axios.get<RoomTypesResponse>(
          `${backendUrl}/material-choices`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: 'Bearer sometoken',
            },
            params: {
              apartmentId: apartmentId,
            },
          }
        )
        return data
      } else {
        return {
          data: {
            roomTypes: undefined,
          },
        }
      }
    },
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })

export const useMaterialOptionDetails = ({
  roomTypeId,
  materialOptionGroupId,
  materialOptionId,
}: {
  roomTypeId?: string
  materialOptionGroupId?: string
  materialOptionId?: string
}) =>
  useQuery<MaterialOptionResponse, AxiosError>({
    queryKey: [
      'materialOptionDetails',
      roomTypeId ?? '' + materialOptionGroupId + materialOptionId,
    ],
    queryFn: async () => {
      if (roomTypeId && materialOptionGroupId && materialOptionId) {
        const { data } = await axios.get<MaterialOptionResponse>(
          `${backendUrl}/material-option-details`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: 'Bearer sometoken',
            },
            params: {
              roomTypeId: roomTypeId,
              materialOptionGroupId: materialOptionGroupId,
              materialOptionId: materialOptionId,
            },
          }
        )
        return data
      } else {
        return {
          data: {
            materialOption: undefined,
          },
        }
      }
    },
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })
