import { z } from 'zod'

import { ResidenceAddressSchema } from '../property/schema'
import { ListingSchema } from './listing'

// A block as the vacancy view needs it: dates and reason only.
export const VacantApartmentBlockSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date().nullable(),
  reason: z.string().nullable(),
})

// Tenfast category (upplåtelseform) or tag, as leasing exposes them.
export const VacantApartmentTagSchema = z.object({
  id: z.string(),
  name: z.string(),
})

// One row on the "Publicera" step, composed in core from Tenfast (vacancy,
// rent), property (object, blocks) and leasing (listing history).
export const VacantApartmentSchema = z.object({
  rentalObjectCode: z.string(),
  address: ResidenceAddressSchema.nullable(),
  apartmentNumber: z.string().nullable(),
  propertyCode: z.string().nullable(),
  propertyName: z.string().nullable(),
  buildingCode: z.string().nullable(),
  marketAreaCode: z.string().nullable(),
  marketAreaName: z.string().nullable(), // "Område" in the UI
  residenceTypeName: z.string().nullable(), // "3 rum och kök"
  roomCount: z.number().nullable(),
  floor: z.string().nullable(),
  elevator: z.boolean().nullable(),
  area: z.number().nullable(), // BRA, m²
  rent: z.number(), // monthly, excl. VAT, from Tenfast
  rentalTenureType: VacantApartmentTagSchema.nullable(), // Tenfast category
  rentalTags: z.array(VacantApartmentTagSchema), // Tenfast tags, e.g. student
  vacantFrom: z.coerce.date().nullable(),
  block: VacantApartmentBlockSchema.nullable(), // latest block, if any
  listing: ListingSchema.nullable(), // Draft listing, when one exists
  closedListingsSinceLastLease: z.number().int(), // failed rounds for this vacancy
})

export type VacantApartment = z.infer<typeof VacantApartmentSchema>
