import { Comment, CommentThread, CommentThreadId } from 'onecore-types'
import { DbComment } from './types'
import { leasing } from 'onecore-types'
import z from 'zod'

import { db } from './db'

const getCommentThreadById = async (
  threadId: CommentThreadId,
  dbConnection = db
): Promise<CommentThread | undefined> => {
  const comments = await dbConnection
    .from('comment AS c')
    .select<Array<DbComment>>(
      'c.id AS Id',
      'c.createdAt AS CreatedAt',
      'c.type AS Type',
      'c.authorId AS AuthorId',
      'c.authorName AS AuthorName',
      'c.comment AS Comment'
    )
    .where({
      TargetType: threadId.targetType,
      TargetId: threadId.targetId,
    })
    .orderBy('CreatedAt', 'desc')

  return {
    id: threadId,
    comments: comments.map((c: DbComment) => {
      return {
        id: c.Id,
        authorName: c.AuthorName,
        authorId: c.AuthorId,
        type: c.Type,
        comment: c.Comment,
        createdAt: c.CreatedAt,
      }
    }),
  }
}

type AddCommentRequest = z.infer<
  typeof leasing.v1.AddCommentRequestParamsSchema
>

const addComment = async (
  threadId: CommentThreadId,
  comment: AddCommentRequest,
  dbConnection = db
): Promise<Comment | undefined> => {
  const [inserted] = await dbConnection
    .table('comment')
    .insert({
      TargetType: threadId.targetType,
      TargetId: threadId.targetId,
      AuthorName: comment.authorName,
      AuthorId: comment.authorId,
      Type: comment.type,
      Comment: comment.comment,
    })
    .returning('*')

  return {
    id: inserted.id,
    authorName: inserted.authorName,
    authorId: inserted.authorId,
    type: inserted.type,
    comment: inserted.comment,
    createdAt: inserted.createdAt,
  }
}

const removeComment = async (
  threadId: CommentThreadId,
  commentId: number,
  dbConnection = db
): Promise<void | undefined> => {
  await dbConnection
    .table('comment')
    .where({
      Id: commentId,
      TargetType: threadId.targetType,
      TargetId: threadId.targetId,
    })
    .delete()

  return
}

export default { getCommentThreadById, addComment, removeComment }
