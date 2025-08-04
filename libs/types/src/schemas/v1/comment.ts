import { z } from 'zod'

export const CommentThreadIdSchema = z.object({
  targetType: z.string(),
  targetId: z.number().int(),
})

export const CommentTypeSchema = z.enum(['COMMENT', 'WARNING', 'STOP'])

export const CommentSchema = z.object({
  id: z.number().int(),
  type: CommentTypeSchema,
  authorName: z.string(),
  authorId: z.string(),
  comment: z.string(),
  createdAt: z.date(),
})

export const CommentThreadSchema = z.object({
  id: CommentThreadIdSchema,
  comments: z.array(CommentSchema),
})
