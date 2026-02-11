import { GET, POST } from './base-api'
import type {
  TenantComment,
  TenantCommentRaw,
  TenantCommentsResponse,
  TenantCommentNote,
} from '@/services/types'

/**
 * Converts a note to a flattened TenantComment for UI display
 * Combines date + time into ISO datetime, or null if date is missing
 */
function transformNote(
  note: TenantCommentNote,
  commentKey: string,
  index: number,
  commentType?: string
): TenantComment {
  let createdAt: string | null = null

  if (note.date) {
    // Use provided time or default to start of day for date-only signatures
    const time = note.time || '00:00'
    const dateTimeString = `${note.date}T${time}:00`
    createdAt = new Date(dateTimeString).toISOString()
  }

  return {
    id: `${commentKey}-${index}`,
    commentKey,
    text: note.text,
    author: note.author,
    createdAt,
    // Track if we have the original time for display purposes
    hasTime: !!note.time,
    commentType: commentType as 'Standard' | 'Sökande' | undefined,
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
    transformNote(note, raw.commentKey, index, raw.commentType)
  )
}

/**
 * Fetch all comments for a specific contact
 * @param contactCode - The contact code to fetch comments for
 * @param commentType - Optional filter for comment type ('Standard' or 'Sökande')
 */
async function getCommentsByContactCode(
  contactCode: string,
  commentType?: 'Standard' | 'Sökande'
): Promise<TenantComment[]> {
  const { data, error } = await GET('/contacts/{contactCode}/comments', {
    params: {
      path: { contactCode },
      query: commentType ? { commentType } : undefined,
    },
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
 * @param contactCode - The contact code
 * @param content - The comment content
 * @param author - The author name/initials
 * @param commentType - The type of comment ('Standard' or 'Sökande'), defaults to 'Standard'
 */
async function createContactComment(
  contactCode: string,
  content: string,
  author: string,
  commentType: 'Standard' | 'Sökande' = 'Standard'
): Promise<TenantCommentRaw> {
  const { data, error } = await POST('/contacts/{contactCode}/comments', {
    params: { path: { contactCode } },
    body: {
      content,
      author,
      commentType,
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
