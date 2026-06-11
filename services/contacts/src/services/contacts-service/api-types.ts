import z from 'zod'
import {
  GetContactResponseBodySchema,
  GetContactsResponseBodySchema,
  GetRelatedContactsResponseBodySchema,
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
