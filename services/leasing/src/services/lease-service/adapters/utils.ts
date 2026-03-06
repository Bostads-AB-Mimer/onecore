type CamelToPascal<S extends string> = S extends `${infer F}${infer R}`
  ? `${Uppercase<F>}${R}`
  : S

type PascalToCamel<S extends string> = S extends `${infer F}${infer R}`
  ? `${Lowercase<F>}${R}`
  : S

export type PascalToCamelObject<T> = {
  [K in keyof T as PascalToCamel<K & string>]: T[K]
}

export type CamelToPascalObject<T> = {
  [K in keyof T as CamelToPascal<K & string>]: T[K]
}

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
const uncapitalize = (str: string) => str.charAt(0).toLowerCase() + str.slice(1)

export const camelToPascal = <T>(obj: { [K in keyof T]: T[K] }) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [capitalize(k), v])
  ) as CamelToPascalObject<T>

export const pascalToCamel = <T>(obj: { [K in keyof T]: T[K] }) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [uncapitalize(k), v])
  ) as PascalToCamelObject<T>

export const trimRow = (obj: any): any => {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trimEnd() : value,
    ])
  )
}

/**
 * Converts RTF formatted text to plain text.
 * Handles both standard RTF format and Xpand's custom comment format.
 *
 * @param rtfText - RTF formatted string or Xpand comment format
 * @returns Plain text string with formatting removed
 */
export const convertRtfToPlainText = (
  rtfText: string | null | undefined
): string => {
  // Handle null/undefined/empty cases
  if (!rtfText || rtfText.trim() === '') {
    return ''
  }

  // For Xpand format (metadata line without full RTF structure)
  // Format: "Font; ;; \\* RichVersion Date Time USER: actual text"
  // This appears to be a single-line representation of RTF metadata + content
  if (rtfText.includes('\\*') && !rtfText.trim().startsWith('{\\rtf')) {
    // Extract everything after the metadata prefix
    // Find the user/timestamp part and extract from there
    const match = rtfText.match(
      /(\d{4}-\d{2}-\d{2}\s+\d{2}:\s*\d{2}\s+\w+:.+)$/
    )
    if (match && match[1]) {
      return decodeXpandText(match[1].trim())
    }
  }

  // Check if text is actually RTF (starts with {\rtf)
  if (rtfText.trim().startsWith('{\\rtf')) {
    return cleanRtfText(rtfText)
  }

  // Not RTF format, return as-is
  return rtfText
}

/**
 * Cleans RTF formatted text using regex
 * Removes RTF formatting to extract plain text content
 */
const cleanRtfText = (rtfText: string): string => {
  let text = rtfText

  // First, remove common RTF header blocks that contain nested braces
  // Match and remove: {\fonttbl{...}}
  text = text.replace(/\{\\fonttbl(?:\{[^}]*\}|\s)*\}/g, '')
  // Match and remove: {\colortbl ...;}
  text = text.replace(/\{\\colortbl[^}]*\}/g, '')
  // Match and remove: {\*\generator ...}
  text = text.replace(/\{\\?\*?\\generator[^}]*\}/g, '')

  // Convert \par to newlines before removing other control words
  text = text.replace(/\\par\b/g, '\n')

  // Decode hex-encoded special characters BEFORE removing control words
  // This handles \'XX format (backslash-apostrophe-hex)
  text = text.replace(/\\'([0-9a-f]{2})/gi, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16))
  })

  // Remove all RTF control words (backslash followed by letters/numbers)
  // This includes \rtf1, \ansi, \pard, \f0, \fs18, etc.
  text = text.replace(/\\[a-z]+[0-9]*/gi, '')

  // Remove all remaining braces
  text = text.replace(/[{}]/g, '')

  // Clean up excessive whitespace while preserving paragraph breaks
  // Replace multiple consecutive spaces with single space
  text = text.replace(/ +/g, ' ')
  // Replace more than 2 consecutive newlines with 2
  text = text.replace(/\n{3,}/g, '\n\n')
  // Trim leading/trailing whitespace from each line
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
  // Trim overall
  text = text.trim()

  return text
}

/**
 * Decodes Xpand's special character encoding (e.g., 'e4 for ä)
 */
const decodeXpandText = (text: string): string => {
  // Replace hex-encoded characters like 'XX with their Unicode equivalents
  let decoded = text.replace(/'([0-9a-f]{2})/gi, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16))
  })

  // Remove RTF control sequences
  decoded = decoded
    .replace(/\\par\s*/g, '\n') // Convert \par to newlines
    .replace(/\\[a-z][a-z0-9-]*/gi, '') // Remove other RTF control words
    .replace(/[{}]/g, '') // Remove braces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  return decoded
}

/**
 * Note structure for parsed comments
 */
export interface Note {
  date: string | null
  time: string | null
  author: string
  text: string
}

/**
 * Parses plain text comment into structured notes array
 * Signature patterns:
 * - YYYY-MM-DD HH:MM AUTHOR: (with time)
 * - YYYY-MM-DD AUTHOR: (without time, for manually typed signatures)
 *
 * @param text - Plain text comment (already converted from RTF)
 * @returns Array of parsed notes with metadata
 */
export const parseNotesFromText = (text: string): Note[] => {
  // Handle empty text
  if (!text || text.trim() === '') {
    return []
  }

  // Regex to match signature pattern: YYYY-MM-DD [HH:MM] AUTHOR:
  // Time is optional to support manually typed signatures like "2021-02-16 DITKAM:"
  // Author can be any non-whitespace characters (flexible length and format)
  const signaturePattern = /(\d{4}-\d{2}-\d{2})\s+(?:(\d{2}:\d{2})\s+)?(\S+):/g
  const matches = Array.from(text.matchAll(signaturePattern))

  if (matches.length === 0) {
    // No signatures found - single unsigned note
    return [
      {
        date: null,
        time: null,
        author: 'Notering utan signatur',
        text: text.trim(),
      },
    ]
  }

  const notes: Note[] = []

  // Check for leading content before first signature
  const firstMatchIndex = matches[0].index!
  if (firstMatchIndex > 0) {
    const leadingText = text.substring(0, firstMatchIndex).trim()
    if (leadingText) {
      notes.push({
        date: null,
        time: null,
        author: 'Notering utan signatur',
        text: leadingText,
      })
    }
  }

  // Parse each signed note
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const startIndex = match.index! + match[0].length
    const endIndex =
      i < matches.length - 1 ? matches[i + 1].index! : text.length

    const content = text.substring(startIndex, endIndex).trim()

    notes.push({
      date: match[1], // YYYY-MM-DD
      time: match[2] || null, // HH:MM or null if not present
      author: match[3], // Author code (variable length)
      text: content,
    })
  }

  return notes
}

/**
 * Formats a note with timestamp and author signature
 * Pattern: YYYY-MM-DD HH:MM AUTHOR: content
 *
 * @param author - 6-letter uppercase author code
 * @param content - Plain text content of the note
 * @param timestamp - Optional timestamp (defaults to current time)
 * @returns Formatted note string
 */
export const formatNoteWithSignature = (
  author: string,
  content: string,
  timestamp?: Date
): string => {
  const date = timestamp || new Date()

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  const dateStr = `${year}-${month}-${day}`
  const timeStr = `${hours}:${minutes}`

  return `${dateStr} ${timeStr} ${author}: ${content}`
}
