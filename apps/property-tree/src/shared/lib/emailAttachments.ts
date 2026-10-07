import {
  EMAIL_ATTACHMENT_ALLOWED_CONTENT_TYPES,
  EMAIL_ATTACHMENT_MAX_COUNT,
  EMAIL_ATTACHMENT_MAX_TOTAL_BYTES,
  type EmailAttachment,
} from '@onecore/types'

import { fileToBase64 } from './file'
import { formatFileSize } from './fileUtils'

// Value for the file input's `accept` attribute.
export const EMAIL_ATTACHMENT_ACCEPT =
  EMAIL_ATTACHMENT_ALLOWED_CONTENT_TYPES.join(',')

export const EMAIL_ATTACHMENT_LIMIT_TEXT = `Max ${EMAIL_ATTACHMENT_MAX_COUNT} filer, totalt ${formatFileSize(
  EMAIL_ATTACHMENT_MAX_TOTAL_BYTES
)}. PDF, bilder, Word, Excel, text och CSV.`

const isAllowedType = (type: string) =>
  (EMAIL_ATTACHMENT_ALLOWED_CONTENT_TYPES as readonly string[]).includes(type)

/**
 * Adds files to the current selection, applying the same limits the
 * communication service enforces. Rejected files are left out and described in
 * `errors` so the user knows why.
 */
export function addEmailAttachmentFiles(
  current: File[],
  incoming: File[]
): { files: File[]; errors: string[] } {
  const files = [...current]
  const errors: string[] = []
  let totalBytes = files.reduce((sum, f) => sum + f.size, 0)

  for (const file of incoming) {
    if (!isAllowedType(file.type)) {
      errors.push(`${file.name}: filtypen stöds inte`)
    } else if (files.length >= EMAIL_ATTACHMENT_MAX_COUNT) {
      errors.push(
        `${file.name}: max ${EMAIL_ATTACHMENT_MAX_COUNT} filer per mejl`
      )
    } else if (totalBytes + file.size > EMAIL_ATTACHMENT_MAX_TOTAL_BYTES) {
      errors.push(
        `${file.name}: bilagorna får vara högst ${formatFileSize(
          EMAIL_ATTACHMENT_MAX_TOTAL_BYTES
        )} totalt`
      )
    } else {
      files.push(file)
      totalBytes += file.size
    }
  }

  return { files, errors }
}

export async function toEmailAttachments(
  files: File[]
): Promise<EmailAttachment[]> {
  return Promise.all(
    files.map(async (file) => ({
      filename: file.name,
      content: await fileToBase64(file),
      contentType: file.type,
    }))
  )
}
