import { z } from 'zod'

export const ContactCommentSchema = z.object({
  contactKey: z.string(), // keycmctc - internal key
  contactCode: z.string(), // cmctckod
  commentKey: z.string(), // keycmmem - internal key
  id: z.number(), // Comment type ID (210 for contact comments)
  commentType: z.string().nullable(), // Comment type/category name
  text: z.string(), // Plain text (converted from RTF)
  priority: z.number().nullable(), // Priority level
  kind: z.number().nullable(), // Comment kind/category
})

export const GetContactCommentsResponseSchema = z.array(ContactCommentSchema)

export type ContactComment = z.infer<typeof ContactCommentSchema>
export type GetContactCommentsResponse = z.infer<
  typeof GetContactCommentsResponseSchema
>
