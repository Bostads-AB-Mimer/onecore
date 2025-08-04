import { z } from 'zod'

export const ParkingSpaceSchema = z.object({
  rentalId: z.string(),
  companyCode: z.string(),
  companyName: z.string(),
  managementUnitCode: z.string(),
  managementUnitName: z.string(),
  propertyCode: z.string(),
  propertyName: z.string(),
  buildingCode: z.string().nullable(),
  buildingName: z.string().nullable(),
  parkingSpace: z.object({
    propertyObjectId: z.string(),
    code: z.string(),
    name: z.string(),
    parkingNumber: z.string(),
    parkingSpaceType: z.object({
      code: z.string(),
      name: z.string(),
    }),
  }),
  address: z
    .object({
      streetAddress: z.string().nullable(),
      streetAddress2: z.string().nullable(),
      postalCode: z.string().nullable(),
      city: z.string().nullable(),
    })
    .nullable(),
})

export type ParkingSpace = z.infer<typeof ParkingSpaceSchema>
