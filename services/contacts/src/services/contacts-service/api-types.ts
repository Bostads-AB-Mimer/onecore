import z from 'zod'
import {
  GetContactResponseBodySchema,
  GetContactsResponseBodySchema,
  SyncContactsResponseBodySchema,
} from './schema'

export type GetContactResponseBody = z.infer<
  typeof GetContactResponseBodySchema
>

export type GetContactsResponseBody = z.infer<
  typeof GetContactsResponseBodySchema
>

export type SyncContactsResponseBody = z.infer<
  typeof SyncContactsResponseBodySchema
>
