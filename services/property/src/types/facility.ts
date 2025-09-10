import { z } from 'zod'

import { createGenericResponseSchema } from './response'

export const FacilityDetailsSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  entrance: z.string().nullable(),
  deleted: z.boolean(),
  type: z.object({
    code: z.string(),
    name: z.string().nullable(),
  }),
  rentalInformation: z
    .object({
      apartmentNumber: z.string().nullable(),
      rentalId: z.string().nullable(),
      type: z.object({
        code: z.string(),
        name: z.string().nullable(),
      }),
    })
    .nullable(),
  property: z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    code: z.string().nullable(),
  }),
  building: z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    code: z.string().nullable(),
  }),
  area: z.number().nullable(),
})

export const GetFacilitySchema = createGenericResponseSchema(
  FacilityDetailsSchema
)

export type GetFacility = z.infer<typeof GetFacilitySchema>

export const GetFacilitiesSchema = createGenericResponseSchema(
  z.array(FacilityDetailsSchema)
)

export type GetFacilities = z.infer<typeof GetFacilitiesSchema>
