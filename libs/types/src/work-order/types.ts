import { z } from 'zod'
import {
  CloseWorkOrderRequestSchema,
  CreateInspectionWorkOrderGroupSchema,
  CreateInspectionWorkOrderResultSchema,
  CreateInspectionWorkOrdersRequestSchema,
  CreateInspectionWorkOrdersResponseSchema,
  MaintenanceTeamSchema,
} from './schema'

export type MaintenanceTeam = z.infer<typeof MaintenanceTeamSchema>
export type CreateInspectionWorkOrderGroup = z.infer<
  typeof CreateInspectionWorkOrderGroupSchema
>
export type CreateInspectionWorkOrdersRequest = z.infer<
  typeof CreateInspectionWorkOrdersRequestSchema
>
export type CreateInspectionWorkOrderResult = z.infer<
  typeof CreateInspectionWorkOrderResultSchema
>
export type CreateInspectionWorkOrdersResponse = z.infer<
  typeof CreateInspectionWorkOrdersResponseSchema
>
export type CloseWorkOrderRequest = z.infer<typeof CloseWorkOrderRequestSchema>
