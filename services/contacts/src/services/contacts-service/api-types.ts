import z from 'zod'
import {
  AddRelationErrorCodeSchema,
  AddRelationRequestBodySchema,
  CreateContactErrorCodeSchema,
  CreateContactErrorResponseBodySchema,
  CreateContactRequestBodySchema,
  CreateContactResponseBodySchema,
  GetContactResponseBodySchema,
  GetContactsResponseBodySchema,
  GetRelatedContactsResponseBodySchema,
  RelationErrorResponseBodySchema,
  RelationRoleTypeSchema,
  RemoveRelationErrorCodeSchema,
  SyncContactsResponseBodySchema,
} from './schema'

export type GetContactResponseBody = z.infer<
  typeof GetContactResponseBodySchema
>

export type GetContactsResponseBody = z.infer<
  typeof GetContactsResponseBodySchema
>

export type GetRelatedContactsResponseBody = z.infer<
  typeof GetRelatedContactsResponseBodySchema
>

export type SyncContactsResponseBody = z.infer<
  typeof SyncContactsResponseBodySchema
>

export type CreateContactRequestBody = z.infer<
  typeof CreateContactRequestBodySchema
>

export type CreateContactResponseBody = z.infer<
  typeof CreateContactResponseBodySchema
>

export type CreateContactErrorResponseBody = z.infer<
  typeof CreateContactErrorResponseBodySchema
>

export type CreateContactErrorCode = z.infer<
  typeof CreateContactErrorCodeSchema
>

export type RelationRoleType = z.infer<typeof RelationRoleTypeSchema>

export type AddRelationRequestBody = z.infer<
  typeof AddRelationRequestBodySchema
>

export type AddRelationErrorCode = z.infer<typeof AddRelationErrorCodeSchema>

export type RemoveRelationErrorCode = z.infer<
  typeof RemoveRelationErrorCodeSchema
>

export type RelationErrorResponseBody = z.infer<
  typeof RelationErrorResponseBodySchema
>
