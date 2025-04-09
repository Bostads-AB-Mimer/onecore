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
})

export const SearchResultSchema = z
  .discriminatedUnion('type', [
    PropertySearchResultSchema,
    BuildingSearchResultSchema,
  ])
  .describe('A search result that can be either a property or a building')

export const SearchQueryParamsSchema = z.object({
  q: z
    .string()
    .min(3, { message: 'Search query must be at least 3 characters long' })
    .describe('The search query string used to find properties and buildings'),
})

export type PropertySearchResult = z.infer<typeof PropertySearchResultSchema>
export type BuildingSearchResult = z.infer<typeof BuildingSearchResultSchema>
export type SearchResult = z.infer<typeof SearchResultSchema>
export type SearchQueryParams = z.infer<typeof SearchQueryParamsSchema>
