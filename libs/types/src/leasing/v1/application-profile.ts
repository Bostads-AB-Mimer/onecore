import {
  ApplicationProfileHousingReferenceSchema,
  ApplicationProfileSchema,
} from '../../schemas/v1'

export const GetApplicationProfileResponseDataSchema = ApplicationProfileSchema

export const CreateOrUpdateApplicationProfileRequestParamsSchema =
  ApplicationProfileSchema.pick({
    numAdults: true,
    numChildren: true,
    expiresAt: true,
    housingTypeDescription: true,
    landlord: true,
    lastUpdatedAt: true,
  }).extend({
    housingType: ApplicationProfileSchema.shape.housingType.unwrap(),
    housingReference: ApplicationProfileHousingReferenceSchema.pick({
      email: true,
      expiresAt: true,
      phone: true,
      reviewStatus: true,
      comment: true,
      reasonRejected: true,
      reviewedAt: true,
      reviewedBy: true,
    }),
  })

export const CreateOrUpdateApplicationProfileResponseDataSchema =
  ApplicationProfileSchema
