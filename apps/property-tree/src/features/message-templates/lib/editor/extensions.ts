import { TableKit } from '@tiptap/extension-table'
import { Image } from '@tiptap/extension-image'
import StarterKit from '@tiptap/starter-kit'

import { EscapedParagraph } from './escapedParagraph'
import { FactTable } from './factTable'
import { PlaceholderMark } from './placeholderMark'

// A link address may be a placeholder; the backend checks what it fills to.
const PLACEHOLDER_URL = /^\{\{\w+\}\}$/

/**
 * The template document: what the backend renderer styles, nothing more.
 * Code, quotes, strike, underline and rules are off since the email has no
 * look for them. Used by the editor and by the markdown round-trip test.
 */
export const templateExtensions = (labels: Record<string, string> = {}) => [
  StarterKit.configure({
    paragraph: false,
    heading: { levels: [2, 3] }, // heading and subheading in the email
    blockquote: false,
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    link: {
      openOnClick: false,
      autolink: false,
      isAllowedUri: (url, ctx) =>
        PLACEHOLDER_URL.test(url) || ctx.defaultValidate(url),
    },
  }),
  EscapedParagraph,
  TableKit.configure({ table: false }),
  FactTable,
  Image,
  PlaceholderMark.configure({ labels }),
]
