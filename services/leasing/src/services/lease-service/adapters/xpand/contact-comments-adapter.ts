import { xpandDb } from './xpandDb'
import { logger } from '@onecore/utilities'
import { AdapterResult } from '../types'
import { trimRow, convertRtfToPlainText, parseNotesFromText } from '../utils'
import { leasing } from '@onecore/types'

type ContactComment = leasing.v1.ContactComment

export const getContactCommentsByContactCode = async (
  contactCode: string
): Promise<
  AdapterResult<ContactComment[], 'contact-not-found' | 'database-error'>
> => {
  try {
    const rows = await xpandDb
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
      .where('cmmem.id', '=', 210) // Fixed filter for contact comments
      .orderBy(['cmctc.keycmctc', 'cmmem.keycmmem'])

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
