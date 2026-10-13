import { z } from 'zod'

import { ListingStatus } from '../enums'

// Zod twin of the Listing interface (types.ts) minus rentalObject, for
// routes that register their response shape. Keep the two in sync.
// TODO(UTH-389): this becomes Listing (the stored row); the composed view
// moves to ListingWithObjectDetails, and ListingWithoutRentalObject goes.
export const ListingSchema = z.object({
  id: z.number(),
  rentalObjectCode: z.string(),
  publishedFrom: z.coerce.date().nullable().optional(),
  publishedTo: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(ListingStatus),
  rentalRule: z.enum(['SCORED', 'NON_SCORED']),
  listingCategory: z.enum(['PARKING_SPACE', 'APARTMENT', 'STORAGE']),
  reviewedAt: z.coerce.date().nullable().optional(),
  reviewedBy: z.string().nullable().optional(),
})

export type ListingRecord = z.infer<typeof ListingSchema>

export const ListingCategorySchema = ListingSchema.shape.listingCategory

export type ListingCategory = z.infer<typeof ListingCategorySchema>

// Where one rental object stands in the letting process: the one listing
// that is still open (at most one per code, by unique index) plus how many
// rounds have been closed without a tenant during the current vacancy.
export const RentalObjectListingSummarySchema = z.object({
  rentalObjectCode: z.string(),
  currentListing: ListingSchema.nullable(),
  closedListingsSinceLastLease: z.number().int(), // all closed rounds when no lease is known
})

export type RentalObjectListingSummary = z.infer<
  typeof RentalObjectListingSummarySchema
>

export const GetListingSummariesRequestSchema = z.object({
  rentalObjects: z
    .array(
      z.object({
        rentalObjectCode: z.string().min(1),
        listingHistorySince: z.coerce.date().nullable(), // closed rounds before this belong to an earlier tenancy; null counts all
      })
    )
    .min(1)
    .max(5000),
  listingCategory: ListingCategorySchema,
})

export type GetListingSummariesRequest = z.infer<
  typeof GetListingSummariesRequestSchema
>
