import { z } from 'zod'

export const componentsQueryParamsSchema = z.object({
  buildingCode: z
    .string()
    .min(7, { message: 'buildingCode must be at least 7 characters long.' }),
  floorCode: z.string().min(1, { message: 'floorCode is required.' }),
  residenceCode: z.string().min(1, { message: 'residenceCode is required.' }),
  roomCode: z.string().min(1, { message: 'roomCode is required.' }),
})

export const ComponentSchema = z.object({
  id: z.string(),
  propertyObjectId: z.string(),
  typeId: z.string(),
  categoryId: z.string().nullable(),
  systemSupplierId: z.string().nullable(),
  ownerUserId: z.string().nullable(),
  constructionPartId: z.string().nullable(),
  itemId: z.string(),
  priceCategoryId: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  manufacturer: z.string().nullable(),
  typeDesignation: z.string().nullable(),
  installationDate: z.date(),
  warrantyEndDate: z.string().datetime().nullable(),
  serves: z.string().nullable(),
  faultReportingAdministration: z.number().int(),
  isArtInventory: z.number().int(),
  deleteMark: z.number().int(),
  fromDate: z.date(),
  toDate: z.date(),
  timestamp: z.string(),
})

export type Component = z.infer<typeof ComponentSchema>
