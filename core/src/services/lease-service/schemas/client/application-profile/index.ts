import { leasing } from 'onecore-types'

export const UpdateApplicationProfileRequestParams =
  leasing.v1.CreateOrUpdateApplicationProfileRequestParamsSchema.pick({
    housingType: true,
    landlord: true,
    numAdults: true,
    numChildren: true,
    housingTypeDescription: true,
  }).extend({
    housingReference:
      leasing.v1.CreateOrUpdateApplicationProfileRequestParamsSchema.shape.housingReference.pick(
        { email: true, phone: true }
      ),
  })

// TODO: Remove this once all routes are migrated to the new application
// profile (with housing references)
export const UpdateApplicationProfileRequestParamsOld =
  leasing.CreateOrUpdateApplicationProfileRequestParamsSchema.pick({
    numChildren: true,
    numAdults: true,
    landlord: true,
    housingType: true,
    housingTypeDescription: true,
  }).extend({
    housingReference:
      leasing.CreateOrUpdateApplicationProfileRequestParamsSchema.shape.housingReference
        .unwrap()
        .pick({ email: true, phone: true })
        .optional(),
  })

export const UpdateApplicationProfileResponseData =
  leasing.v1.CreateOrUpdateApplicationProfileResponseDataSchema.pick({
    contactCode: true,
    expiresAt: true,
    housingType: true,
    housingTypeDescription: true,
    landlord: true,
    numAdults: true,
    numChildren: true,
  }).extend({
    housingReference:
      leasing.v1.CreateOrUpdateApplicationProfileResponseDataSchema.shape.housingReference.pick(
        {
          comment: true,
          email: true,
          phone: true,
          reviewStatus: true,
          expiresAt: true,
        }
      ),
  })

export const GetApplicationProfileResponseData =
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
