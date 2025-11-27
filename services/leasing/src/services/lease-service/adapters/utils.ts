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
