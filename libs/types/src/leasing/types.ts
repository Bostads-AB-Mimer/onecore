import { z } from 'zod'
import {
  HomeInsuranceRowSchema,
  HomeInsuranceEndActionSchema,
  UpdateHomeInsuranceRowRequestSchema,
  UpdateHomeInsuranceRowResponseSchema,
  HomeInsuranceErrorCodeSchema,
  HomeInsuranceLfStatusSchema,
  HomeInsuranceListRowsSchema,
  HomeInsuranceListSortBySchema,
  HomeInsuranceListItemSchema,
  HomeInsuranceListQueryParamsSchema,
  HomeInsuranceListAllQueryParamsSchema,
  HomeInsuranceListErrorCodeSchema,
  LeaseStatusesRequestSchema,
  LeaseStatusItemSchema,
  LeaseStatusesResponseSchema,
  LeaseStatusesErrorCodeSchema,
} from './schema'

export type HomeInsuranceRow = z.infer<typeof HomeInsuranceRowSchema>
export type HomeInsuranceEndAction = z.infer<
  typeof HomeInsuranceEndActionSchema
>
export type UpdateHomeInsuranceRowRequest = z.infer<
  typeof UpdateHomeInsuranceRowRequestSchema
>
export type UpdateHomeInsuranceRowResponse = z.infer<
  typeof UpdateHomeInsuranceRowResponseSchema
>
export type HomeInsuranceErrorCode = z.infer<
  typeof HomeInsuranceErrorCodeSchema
>
export type HomeInsuranceLfStatus = z.infer<typeof HomeInsuranceLfStatusSchema>
export type HomeInsuranceListRows = z.infer<typeof HomeInsuranceListRowsSchema>
export type HomeInsuranceListSortBy = z.infer<
  typeof HomeInsuranceListSortBySchema
>
export type HomeInsuranceListItem = z.infer<typeof HomeInsuranceListItemSchema>
export type HomeInsuranceListQueryParams = z.infer<
  typeof HomeInsuranceListQueryParamsSchema
>
/** Raw input type (before Zod transforms), as a caller sends the query. */
export type HomeInsuranceListQueryParamsInput = z.input<
  typeof HomeInsuranceListQueryParamsSchema
>
export type HomeInsuranceListErrorCode = z.infer<
  typeof HomeInsuranceListErrorCodeSchema
>
export type HomeInsuranceListAllQueryParams = z.infer<
  typeof HomeInsuranceListAllQueryParamsSchema
>
export type LeaseStatusesRequest = z.infer<typeof LeaseStatusesRequestSchema>
export type LeaseStatusItem = z.infer<typeof LeaseStatusItemSchema>
export type LeaseStatusesResponse = z.infer<typeof LeaseStatusesResponseSchema>
export type LeaseStatusesErrorCode = z.infer<
  typeof LeaseStatusesErrorCodeSchema
>
