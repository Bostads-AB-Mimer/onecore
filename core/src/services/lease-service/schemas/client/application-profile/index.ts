import { leasing } from 'onecore-types'

export const UpdateApplicationProfileRequestParams =
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
          lastAdminUpdatedAt: true,
          lastApplicantUpdatedAt: true,
          reasonRejected: true,
          expiresAt: true,
        }
      ),
  })

export const UpdateApplicationProfileResponseData =
  leasing.v1.CreateOrUpdateApplicationProfileResponseDataSchema

export const GetApplicationProfileResponseData =
  leasing.v1.GetApplicationProfileResponseDataSchema
