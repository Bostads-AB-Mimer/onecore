import { z } from 'zod'

export const NoteSchema = z.object({
  date: z.string().nullable(), // ISO date format YYYY-MM-DD
  time: z.string().nullable(), // Time format HH:MM
  author: z.string(), // Author initials or "Notering utan signatur"
  text: z.string(), // Note content (plain text)
})

export const ContactCommentSchema = z.object({
  contactKey: z.string(), // keycmctc - internal key
  contactCode: z.string(), // cmctckod
  commentKey: z.string(), // keycmmem - internal key
  id: z.number(), // Comment type ID (210 for contact comments)
  commentType: z.string().nullable(), // Comment type/category name
  notes: z.array(NoteSchema), // Array of parsed notes
  priority: z.number().nullable(), // Priority level
  kind: z.number().nullable(), // Comment kind/category
})

export const GetContactCommentsResponseSchema = z.array(ContactCommentSchema)

export type Note = z.infer<typeof NoteSchema>
export type ContactComment = z.infer<typeof ContactCommentSchema>
export type GetContactCommentsResponse = z.infer<
  typeof GetContactCommentsResponseSchema
>
