import { leasing } from 'onecore-types'

export const UpdateApplicationProfileRequestParams =
  leasing.CreateOrUpdateApplicationProfileRequestParamsSchema.pick({
    numChildren: true,
    numAdults: true,
    landlord: true,
    housingType: true,
    housingTypeDescription: true,
  }).extend({
    housingReference:
      leasing.CreateOrUpdateApplicationProfileResponseDataSchema.shape.housingReference.pick(
        {
          email: true,
          phone: true,
          reviewStatus: true,
          comment: true,
          lastAdminUpdatedAt: true,
          lastApplicantUpdatedAt: true,
          reasonRejected: true,
          expiresAt: true,
        }
      ),
  })

export const UpdateApplicationProfileResponseData =
  leasing.CreateOrUpdateApplicationProfileResponseDataSchema

export const GetApplicationProfileResponseData =
  leasing.GetApplicationProfileResponseDataSchema
