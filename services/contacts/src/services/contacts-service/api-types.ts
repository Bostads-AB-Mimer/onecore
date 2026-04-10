import z from 'zod'
import {
  GetContactResponseBodySchema,
  GetContactsResponseBodySchema,
} from './schema'

export type GetContactResponseBody = z.infer<
  typeof GetContactResponseBodySchema
>

export type GetContactsResponseBody = z.infer<
  typeof GetContactsResponseBodySchema
>
