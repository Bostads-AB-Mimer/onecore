import type {
  TenantComment,
  TenantCommentNote,
  TenantCommentRaw,
  TenantCommentsResponse,
} from '@/services/types'

import { GET, POST } from './baseApi'

/**
 * Converts a note to a flattened TenantComment for UI display
 * Combines date + time into ISO datetime
 */
function transformNote(
  note: TenantCommentNote,
  commentKey: string,
  index: number
): TenantComment {
  // Combine date and time into ISO datetime
  const dateTimeString = `${note.date}T${note.time}:00`
  const isoDate = new Date(dateTimeString).toISOString()

  return {
    id: `${commentKey}-${index}`,
    commentKey,
    text: note.text,
    author: note.author,
    createdAt: isoDate,
  }
}

/**
 * Converts raw API comment to UI models
 * Flattens the notes array into individual TenantComment objects
 */
function transformComment(raw: TenantCommentRaw): TenantComment[] {
  if (!raw.notes || raw.notes.length === 0) {
    return []
  }

  return raw.notes.map((note, index) =>
    transformNote(note, raw.commentKey, index)
  )
}

/**
 * Fetch all comments for a specific contact
 */
async function getCommentsByContactCode(
  contactCode: string
): Promise<TenantComment[]> {
  const { data, error } = await GET('/contacts/{contactCode}/comments', {
    params: { path: { contactCode } },
  })

  if (error) {
    console.error('Error fetching comments:', error)
    throw new Error(`Failed to fetch comments for contact ${contactCode}`)
  }

  const response = data as any as TenantCommentsResponse
  if (!response?.content) {
    return []
  }

  // Flatten all notes from all comments into a single array
  return response.content.flatMap(transformComment)
}

/**
 * Create a new comment for a specific contact
 */
async function createContactComment(
  contactCode: string,
  content: string,
  author: string
): Promise<TenantCommentRaw> {
  const { data, error } = await POST('/contacts/{contactCode}/comments', {
    params: { path: { contactCode } },
    body: {
      content,
      author,
    },
  })

  if (error) {
    console.error('Error creating comment:', error)
    throw new Error(`Failed to create comment for contact ${contactCode}`)
  }

  const response = data as any
  if (!response?.content) {
    throw new Error('Invalid response from create comment API')
  }

  return response.content as TenantCommentRaw
}

export const commentService = {
  getCommentsByContactCode,
  createContactComment,
}
