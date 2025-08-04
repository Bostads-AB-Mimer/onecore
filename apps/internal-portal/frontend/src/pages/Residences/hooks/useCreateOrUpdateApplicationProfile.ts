import { AxiosError } from 'axios'
import { useMutation } from '@tanstack/react-query'
import { leasing } from 'onecore-types'
import { z } from 'zod'

import apiClient from '../../../utils/api-client'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export const UpdateApplicationProfileRequestParamsSchema =
  leasing.v1.CreateOrUpdateApplicationProfileRequestParamsSchema.pick({
    numChildren: true,
    numAdults: true,
    landlord: true,
    housingType: true,
    housingTypeDescription: true,
  }).extend({
    housingReference:
      leasing.v1.CreateOrUpdateApplicationProfileRequestParamsSchema.shape.housingReference.pick(
        {
          email: true,
          phone: true,
          reviewStatus: true,
          comment: true,
          reasonRejected: true,
          expiresAt: true,
        }
      ),
  })

export type UpdateApplicationProfileRequestParams = z.infer<
  typeof UpdateApplicationProfileRequestParamsSchema
>

type Params = {
  contactCode: string
  applicationProfile: UpdateApplicationProfileRequestParams
}

export const useCreateOrUpdateApplicationProfile = () => {
  return useMutation<unknown, AxiosError, Params>({
    mutationFn: (params: Params) =>
      apiClient.put<unknown>(
        `${backendUrl}/contacts/${params.contactCode}/application-profile`,
        params.applicationProfile
      ),
  })
}
