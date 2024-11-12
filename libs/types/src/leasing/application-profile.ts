import { ApplicationProfileSchema } from '../schemas'

export const GetApplicationProfileResponseDataSchema = ApplicationProfileSchema

export const CreateOrUpdateApplicationProfileRequestParamsSchema =
  ApplicationProfileSchema.pick({
    numAdults: true,
    numChildren: true,
    expiresAt: true,
  })

export const CreateOrUpdateApplicationProfileResponseDataSchema =
  ApplicationProfileSchema
