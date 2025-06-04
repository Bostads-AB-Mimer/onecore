import { z } from 'zod'

export const PropertySearchResultSchema = z.object({
  id: z.string().describe('Unique identifier for the search result'),
  type: z.literal('property').describe('Indicates this is a property result'),
  name: z.string().describe('Name or designation of the property'),
})

export const BuildingSearchResultSchema = z.object({
  id: z.string().describe('Unique identifier for the search result'),
  type: z.literal('building').describe('Indicates this is a building result'),
  name: z.string().describe('Name of the building'),
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

export const SearchResultSchema = z
  .discriminatedUnion('type', [
    PropertySearchResultSchema,
    BuildingSearchResultSchema,
    ResidenceSearchResultSchema,
  ])
  .describe(
    'A search result that can be either a property, building or residence'
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
export type SearchResult = z.infer<typeof SearchResultSchema>
export type SearchQueryParams = z.infer<typeof SearchQueryParamsSchema>
