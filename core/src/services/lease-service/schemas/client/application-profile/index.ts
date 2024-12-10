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
      leasing.CreateOrUpdateApplicationProfileRequestParamsSchema.shape.housingReference
        .unwrap()
        .pick({ email: true, phone: true })
        .optional(),
  })

export const UpdateApplicationProfileResponseData =
  leasing.CreateOrUpdateApplicationProfileResponseDataSchema.pick({
    id: true,
    contactCode: true,
    expiresAt: true,
    housingTypeDescription: true,
    housingType: true,
    landlord: true,
    numAdults: true,
    numChildren: true,
  }).extend({
    housingReference:
      leasing.CreateOrUpdateApplicationProfileResponseDataSchema.shape.housingReference
        .unwrap()
        .pick({
          email: true,
          phone: true,
          expiresAt: true,
        })
        .optional(),
  })

export const GetApplicationProfileResponseData =
  leasing.GetApplicationProfileResponseDataSchema.pick({
    contactCode: true,
    createdAt: true,
    expiresAt: true,
    housingType: true,
    housingTypeDescription: true,
    id: true,
    landlord: true,
    numAdults: true,
    numChildren: true,
  }).extend({
    housingReference:
      leasing.GetApplicationProfileResponseDataSchema.shape.housingReference
        .unwrap()
        .pick({
          email: true,
          phone: true,
          expiresAt: true,
        })
        .optional(),
  })
