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
          reviewedBy: true,
          reasonRejected: true,
          expiresAt: true,
        }
      ),
  })

export const UpdateApplicationProfileResponseData =
  leasing.v1.CreateOrUpdateApplicationProfileResponseDataSchema.pick({
    contactCode: true,
    expiresAt: true,
    housingType: true,
    housingTypeDescription: true,
    id: true,
    landlord: true,
    lastUpdatedAt: true,
    numAdults: true,
    numChildren: true,
    createdAt: true,
  }).extend({
    housingReference:
      leasing.v1.CreateOrUpdateApplicationProfileResponseDataSchema.shape.housingReference.pick(
        {
          comment: true,
          createdAt: true,
          email: true,
          phone: true,
          reviewStatus: true,
          expiresAt: true,
        }
      ),
  })
