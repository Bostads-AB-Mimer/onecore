import { z } from 'zod'

export const PropertySearchResultSchema = z.object({
  id: z.string().describe('Unique identifier for the search result'),
  type: z.literal('property').describe('Indicates this is a property result'),
  name: z.string().describe('Name or designation of the property'),
})

export const BuildingSearchResultSchema = z.object({
  id: z.string().describe('Unique identifier for the search result'),
  type: z.literal('building').describe('Indicates this is a building result'),
  name: z.string().nullable().describe('Name of the building'),
  property: z
    .object({
      name: z
        .string()
        .describe('Property associated with the building')
        .nullable(),
      id: z.string(),
      code: z.string(),
    })
    .nullish(),
})

export const ResidenceSearchResultSchema = z.object({
  id: z.string().describe('Unique identifier for the search result'),
  type: z.literal('residence').describe('Indicates this is a residence result'),
  name: z.string().describe('Name of the residence').nullable(),
  rentalId: z.string().nullable().describe('Rental object ID of the residence'),
  property: z.object({
    code: z.string().nullable(),
    name: z
      .string()
      .describe('Name of property associated with the residence')
      .nullable(),
  }),
  building: z.object({
    code: z.string().nullable(),
    name: z
      .string()
      .describe('Name of building associated with the residence')
      .nullable(),
  }),
})

export const ParkingSpaceSearchResultSchema = z.object({
  id: z.string().describe('Unique identifier for the search result'),
  type: z
    .literal('parking-space')
    .describe('Indicates this is a parking space result'),
  name: z.string().nullable().describe('Name of the parking space'),
  rentalId: z.string().describe('Rental ID of the parking space'),
  code: z.string().describe('Code of the parking space'),
  property: z.object({
    code: z.string().nullable(),
    name: z
      .string()
      .nullable()
      .describe('Name of property associated with the parking space'),
  }),
  building: z.object({
    code: z.string().nullable(),
    name: z
      .string()
      .nullable()
      .describe('Name of building associated with the parking space'),
  }),
})

export const MaintenanceUnitSearchResultSchema = z.object({
  id: z.string().describe('Unique identifier for the search result'),
  type: z
    .literal('maintenance-unit')
    .describe('Indicates this is a maintenance unit result'),
  code: z.string().describe('Code of the maintenance unit'),
  caption: z
    .string()
    .nullable()
    .describe('Caption/name of the maintenance unit'),
  maintenanceType: z.string().nullable().describe('Type of maintenance unit'),
  estateCode: z.string().nullable().describe('Property code'),
  estate: z.string().nullable().describe('Property name'),
})

export const SearchResultSchema = z
  .discriminatedUnion('type', [
    PropertySearchResultSchema,
    BuildingSearchResultSchema,
    ResidenceSearchResultSchema,
    ParkingSpaceSearchResultSchema,
    MaintenanceUnitSearchResultSchema,
  ])
  .describe(
    'A search result that can be either a property, building, residence, parking space or maintenance unit'
  )

export const SearchQueryParamsSchema = z.object({
  q: z
    .string()
    .min(3, { message: 'Search query must be at least 3 characters long' })
    .describe(
      'The search query string used to find properties, buildings and residences'
    ),
})

export type PropertySearchResult = z.infer<typeof PropertySearchResultSchema>
export type BuildingSearchResult = z.infer<typeof BuildingSearchResultSchema>
export type ResidenceSearchResult = z.infer<typeof ResidenceSearchResultSchema>
export type ParkingSpaceSearchResult = z.infer<
  typeof ParkingSpaceSearchResultSchema
>
export type MaintenanceUnitSearchResult = z.infer<
  typeof MaintenanceUnitSearchResultSchema
>
export type SearchResult = z.infer<typeof SearchResultSchema>
export type SearchQueryParams = z.infer<typeof SearchQueryParamsSchema>
