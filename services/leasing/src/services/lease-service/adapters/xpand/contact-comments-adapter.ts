import { xpandDb } from './xpandDb'
import { logger } from '@onecore/utilities'
import { AdapterResult } from '../types'
import {
  trimRow,
  convertRtfToPlainText,
  parseNotesFromText,
  formatNoteWithSignature,
} from '../utils'
import { leasing } from '@onecore/types'

type ContactComment = leasing.v1.ContactComment

// Comment type to database id mapping
const COMMENT_TYPE_IDS: Record<string, number> = {
  Standard: 210,
  Sökande: 0,
}

const getCommentTypeId = (commentType: string): number => {
  return COMMENT_TYPE_IDS[commentType] ?? 210
}

export const getContactCommentsByContactCode = async (
  contactCode: string,
  commentType?: string
): Promise<
  AdapterResult<ContactComment[], 'contact-not-found' | 'database-error'>
> => {
  try {
    let query = xpandDb
      .from('cmctc')
      .select(
        'cmctc.keycmctc',
        'cmctc.cmctckod',
        'cmmem.keycmmem',
        'cmmem.id',
        'cmmem.name',
        'cmmem.text',
        'cmmem.priority',
        'cmmem.kind'
      )
      .join('cmmem', xpandDb.raw('1=1'))
      .whereRaw('RTRIM(cmmem.[keycode]) = RTRIM(cmctc.[keycmctc])')
      .where('cmctc.cmctckod', '=', contactCode)

    // Filter by comment type or include all contact comment types
    if (commentType) {
      const typeId = getCommentTypeId(commentType)
      query = query.where('cmmem.id', '=', typeId).where('cmmem.name', '=', commentType)
    } else {
      // Include both Standard (id=210) and Sökande (id=0) comments
      query = query.whereIn('cmmem.id', [0, 210])
    }

    const rows = await query.orderBy(['cmctc.keycmctc', 'cmmem.keycmmem'])

    if (!rows || rows.length === 0) {
      // Check if contact exists to differentiate 404 from empty results
      const contactExists = await xpandDb
        .from('cmctc')
        .where('cmctckod', '=', contactCode)
        .first()

      if (!contactExists) {
        return { ok: false, err: 'contact-not-found' }
      }

      return { ok: true, data: [] }
    }

    const comments = rows.map(transformDbComment)
    return { ok: true, data: comments }
  } catch (err) {
    logger.error(
      err,
      'contact-comments-adapter.getContactCommentsByContactCode'
    )
    return { ok: false, err: 'database-error' }
  }
}

const transformDbComment = (row: any): ContactComment => {
  const trimmedRow = trimRow(row)

  // Convert RTF to plain text first
  const plainText = convertRtfToPlainText(trimmedRow.text)

  // Parse plain text into structured notes
  const notes = parseNotesFromText(plainText)

  return {
    contactKey: trimmedRow.keycmctc,
    contactCode: trimmedRow.cmctckod,
    commentKey: trimmedRow.keycmmem,
    id: trimmedRow.id,
    commentType: trimmedRow.name,
    notes,
    priority: trimmedRow.priority,
    kind: trimmedRow.kind,
  }
}

/**
 * Generates a unique Xpand key for the cmmem table
 * Format: underscore + 10 random alphanumeric characters
 *
 * @returns Unique key string
 */
const generateXpandKey = async (): Promise<string> => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let key = ''
  let exists = true

  while (exists) {
    key =
      '_' +
      Array.from({ length: 10 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join('')

    const existing = await xpandDb('cmmem').where('keycmmem', '=', key).first()

    exists = !!existing
  }

  return key
}

/**
 * Creates a new contact comment or appends to existing comment
 * This is the first write operation to the Xpand database
 *
 * @param contactCode - Contact code (e.g., "P000047")
 * @param content - Plain text content of the note
 * @param author - 6-letter uppercase author code
 * @param commentType - Type of comment: 'Standard' or 'Sökande' (default: 'Standard')
 * @returns Result with operation type and updated comment
 */
export const upsertContactComment = async (
  contactCode: string,
  content: string,
  author: string,
  commentType: string = 'Standard'
): Promise<
  AdapterResult<
    { operation: 'created' | 'updated'; comment: ContactComment },
    'contact-not-found' | 'database-error'
  >
> => {
  try {
    const result = await xpandDb.transaction(async (trx) => {
      // 1. Verify contact exists and get key
      const contact = await trx('cmctc')
        .select('keycmctc')
        .where('cmctckod', '=', contactCode)
        .first()

      if (!contact) {
        throw new Error('contact-not-found')
      }

      const contactKey = contact.keycmctc
      const typeId = getCommentTypeId(commentType)

      // 2. Check for existing comment of the same type
      const existing = await trx('cmmem')
        .select('*')
        .whereRaw('RTRIM([keycode]) = ?', [contactKey.trim()])
        .where('id', '=', typeId)
        .where('name', '=', commentType)
        .first()

      const newNoteText = formatNoteWithSignature(author, content)

      if (existing) {
        // Update: prepend to existing (newest first) and migrate to plain text format
        const existingPlainText = convertRtfToPlainText(existing.text)
        const combinedPlainText = existingPlainText
          ? `${newNoteText}\n\n${existingPlainText}`
          : newNoteText

        await trx('cmmem').where('keycmmem', '=', existing.keycmmem).update({
          text: combinedPlainText,
          kind: 0, // Migrate to plain text format
        })

        return { operation: 'updated' as const, keycmmem: existing.keycmmem }
      } else {
        // Create new comment with plain text format
        const keycmmem = await generateXpandKey()

        await trx('cmmem').insert({
          keycmmem,
          keycode: contactKey,
          id: typeId,
          name: commentType,
          text: newNoteText,
          priority: 0,
          kind: 0, // Use plain text format
          timestamp: new Date(),
        })

        return { operation: 'created' as const, keycmmem }
      }
    })

    // Fetch and return the complete comment of the same type
    const commentResult = await getContactCommentsByContactCode(
      contactCode,
      commentType
    )

    if (!commentResult.ok) {
      return { ok: false, err: 'database-error' }
    }

    const comment = commentResult.data.find(
      (c) => c.commentType === commentType
    )

    if (!comment) {
      return { ok: false, err: 'database-error' }
    }

    return {
      ok: true,
      data: {
        operation: result.operation,
        comment,
      },
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'contact-not-found') {
      return { ok: false, err: 'contact-not-found' }
    }

    logger.error(err, 'contact-comments-adapter.upsertContactComment')
    return { ok: false, err: 'database-error' }
  }
}
