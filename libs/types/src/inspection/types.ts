import { z } from 'zod'
import {
  INSPECTION_STATUS_FILTER,
  ChecklistSchema,
  XpandInspectionSchema,
  DetailComponentSchema,
  DetailedXpandInspectionRemarkSchema,
  DetailedXpandInspectionRoomSchema,
  DetailedXpandInspectionSchema,
  GetInspectionsFromXpandQuerySchema,
  GetInspectionsByResidenceIdQuerySchema,
  InspectionComponentSchema,
  InspectionRoomSchema,
  InternalInspectionSchema,
  SaveInspectionDraftRequestSchema,
} from './schema'

export type InspectionStatusFilter =
  (typeof INSPECTION_STATUS_FILTER)[keyof typeof INSPECTION_STATUS_FILTER]

export type XpandInspection = z.infer<typeof XpandInspectionSchema>
export type DetailedXpandInspectionRemark = z.infer<
  typeof DetailedXpandInspectionRemarkSchema
>
export type DetailedXpandInspectionRoom = z.infer<
  typeof DetailedXpandInspectionRoomSchema
>
export type DetailedXpandInspection = z.infer<
  typeof DetailedXpandInspectionSchema
>

export type GetInspectionsFromXpandQuery = z.infer<
  typeof GetInspectionsFromXpandQuerySchema
>
export type GetInspectionsByResidenceIdQuery = z.infer<
  typeof GetInspectionsByResidenceIdQuerySchema
>

export type InspectionComponent = z.infer<typeof InspectionComponentSchema>
export type DetailComponent = z.infer<typeof DetailComponentSchema>
export type Checklist = z.infer<typeof ChecklistSchema>
export type InspectionRoom = z.infer<typeof InspectionRoomSchema>
export type InternalInspection = z.infer<typeof InternalInspectionSchema>
export type SaveInspectionDraftRequest = z.infer<
  typeof SaveInspectionDraftRequestSchema
>
