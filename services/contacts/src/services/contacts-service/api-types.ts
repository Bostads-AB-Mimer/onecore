import z from 'zod'
import {
  GetContactResponseBodySchema,
  GetContactsResponseBodySchema,
  PostChannelsResponseBodySchema,
} from './schema'

export type GetContactResponseBody = z.infer<
  typeof GetContactResponseBodySchema
>

export type GetContactsResponseBody = z.infer<
  typeof GetContactsResponseBodySchema
>

export type PostChannelsResponseBody = z.infer<
  typeof PostChannelsResponseBodySchema
>
