import {
  ApplicationProfileHousingReferenceSchema,
  ApplicationProfileSchema,
} from '../schemas'

export const GetApplicationProfileResponseDataSchema = ApplicationProfileSchema

export const CreateOrUpdateApplicationProfileRequestParamsSchema =
  ApplicationProfileSchema.pick({
    numAdults: true,
    numChildren: true,
    expiresAt: true,
    housingType: true,
    housingTypeDescription: true,
    landlord: true,
  }).extend({
    housingReference: ApplicationProfileHousingReferenceSchema.pick({
      email: true,
      expiresAt: true,
      phone: true,
      reviewStatus: true,
      comment: true,
      reasonRejected: true,
      lastAdminUpdatedAt: true,
      lastApplicantUpdatedAt: true,
    }),
  })

export const CreateOrUpdateApplicationProfileResponseDataSchema =
  ApplicationProfileSchema
