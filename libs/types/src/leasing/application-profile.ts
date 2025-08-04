import {
  ApplicationProfileHousingReferenceSchema,
  ApplicationProfileSchema,
} from '../schemas'

/** @deprecated */
export const GetApplicationProfileResponseDataSchema = ApplicationProfileSchema

/** @deprecated */
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
      reviewStatusReason: true,
      reviewedAt: true,
    }).optional(),
  })

/** @deprecated */
export const CreateOrUpdateApplicationProfileResponseDataSchema =
  ApplicationProfileSchema
