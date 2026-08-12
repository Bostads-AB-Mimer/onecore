import { CommentSchema } from '../../schemas/v1'

export const AddCommentRequestParamsSchema = CommentSchema.pick({
  type: true,
  comment: true,
  authorName: true,
  authorId: true,
})

export const UpdateCommentRequestParamsSchema = CommentSchema.pick({
  type: true,
  comment: true,
})
