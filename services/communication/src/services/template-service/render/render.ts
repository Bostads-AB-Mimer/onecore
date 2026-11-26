import MarkdownIt from 'markdown-it'
import he from 'he'

import { EMAIL_STYLES, IMAGE_WIDTH } from './styles'
import { TrustedHtml } from './trusted-html'

type Token = MarkdownIt.Token
// A TrustedHtml value goes in as HTML when it is alone in its paragraph;
// every plain string is escaped.
export type PlaceholderValue = string | TrustedHtml
export type Placeholders = Record<string, PlaceholderValue>

const textOf = (value: PlaceholderValue) =>
  typeof value === 'string' ? value : value.text

export class MissingPlaceholderError extends Error {
  readonly code = 'MISSING_PLACEHOLDER'
  constructor(readonly tokens: string[]) {
    super(`Missing placeholder values: ${tokens.join(', ')}`)
    this.name = 'MissingPlaceholderError'
  }
}

export class InvalidPlaceholderUrlError extends Error {
  readonly code = 'INVALID_PLACEHOLDER_URL'
  constructor(readonly token: string) {
    super(`Placeholder ${token} is not an allowed URL`)
    this.name = 'InvalidPlaceholderUrlError'
  }
}

// A send's own data couldn't be turned into placeholder values (e.g. an
// unparseable date); thrown before anything is sent.
export class InvalidPlaceholderValueError extends Error {
  readonly code = 'INVALID_PLACEHOLDER_VALUE'
  constructor(options?: ErrorOptions) {
    super('Could not build placeholder values from the send data', options)
    this.name = 'InvalidPlaceholderValueError'
  }
}

const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g
// Private-use characters markdown-it treats as plain text, so a protected
// token can't be formatted, escaped or URL-encoded before it is filled.
const SLOT_RE = /(\d+)/g
const SLOT_ONE = /(\d+)/
const LINK_PROTOCOL = /^(https:|mailto:|tel:)/i
const IMAGE_PROTOCOL = /^https:/i
// Link title that turns a link into a button: [Svara](url "button").
const BUTTON_TITLE = 'button'

const hasValue = (placeholders: Placeholders, key: string) =>
  Object.hasOwn(placeholders, key) &&
  (typeof placeholders[key] === 'string' ||
    placeholders[key] instanceof TrustedHtml)

const assertNoMissing = (text: string, placeholders: Placeholders) => {
  const missing = new Set<string>()
  for (const [, key] of text.matchAll(TOKEN_RE)) {
    if (!hasValue(placeholders, key)) missing.add(key)
  }
  if (missing.size > 0) throw new MissingPlaceholderError([...missing])
}

/** Fills {{token}} with raw values (TrustedHtml as its text). Throws if any token has no value. */
export const fillPlaceholders = (
  text: string,
  placeholders: Placeholders
): string => {
  assertNoMissing(text, placeholders)
  return text.replace(TOKEN_RE, (_m, key: string) => textOf(placeholders[key]))
}

// Per-render state, passed to the renderer rules through markdown-it's env.
// htmlBlocks: slots holding TrustedHtml alone in a paragraph, inserted as HTML.
type RenderEnv = {
  names: string[]
  values: PlaceholderValue[]
  htmlBlocks: Set<number>
  column: number
}

const fillSlots = (text: string, env: RenderEnv) =>
  text.replace(SLOT_RE, (_m, i: string) => textOf(env.values[Number(i)]))

// Fills the slots in a URL attribute and checks the result's protocol, so a
// value can't turn a link into javascript: (or similar). HTML is never a URL.
const fillUrl = (url: string, env: RenderEnv, allowed: RegExp): string => {
  const slot = url.match(SLOT_ONE)
  if (!slot) return url
  for (const [, i] of url.matchAll(SLOT_RE)) {
    if (env.values[Number(i)] instanceof TrustedHtml) {
      throw new InvalidPlaceholderUrlError(env.names[Number(i)])
    }
  }
  const filled = fillSlots(url, env)
  if (!allowed.test(filled.trim())) {
    throw new InvalidPlaceholderUrlError(env.names[Number(slot[1])])
  }
  return filled
}

const createMarkdown = (): MarkdownIt => {
  const md = new MarkdownIt('commonmark', { html: false, breaks: true })
  md.enable('table')

  const defaultNormalizeLink = md.normalizeLink.bind(md)
  const defaultValidateLink = md.validateLink.bind(md)
  md.normalizeLink = (url) =>
    SLOT_ONE.test(url) ? url : defaultNormalizeLink(url)
  md.validateLink = (url) => SLOT_ONE.test(url) || defaultValidateLink(url)

  // A paragraph holding only an empty value (e.g. an optional field left empty)
  // would leave a blank block; drop it once we know the values.
  md.core.ruler.push('drop_empty_paragraphs', (state) => {
    const env: RenderEnv = state.env
    for (let i = state.tokens.length - 3; i >= 0; i--) {
      const [open, inline, close] = state.tokens.slice(i, i + 3)
      if (
        open.type === 'paragraph_open' &&
        close.type === 'paragraph_close' &&
        (inline.children ?? []).every((c) => c.type === 'text') &&
        fillSlots(inline.content, env).trim() === ''
      ) {
        state.tokens.splice(i, 3)
      }
    }
  })

  // A paragraph holding only a TrustedHtml value: the value brings its own
  // <p>s, so hide ours instead of nesting paragraphs.
  md.core.ruler.push('unwrap_html_paragraphs', (state) => {
    const env: RenderEnv = state.env
    for (let i = 0; i + 2 < state.tokens.length; i++) {
      const [open, inline, close] = state.tokens.slice(i, i + 3)
      const slot = inline.content.trim().match(SLOT_ONE)
      if (
        open.type === 'paragraph_open' &&
        close.type === 'paragraph_close' &&
        slot?.[0] === inline.content.trim() &&
        env.values[Number(slot[1])] instanceof TrustedHtml
      ) {
        open.hidden = true
        close.hidden = true
        env.htmlBlocks.add(Number(slot[1]))
      }
    }
  })

  // Fact tables are written with an empty header row (| | |); drop it.
  md.core.ruler.push('drop_empty_thead', (state) => {
    for (let start = state.tokens.length - 1; start >= 0; start--) {
      if (state.tokens[start].type !== 'thead_open') continue
      const end = state.tokens.findIndex(
        (t, i) => i > start && t.type === 'thead_close'
      )
      const empty = state.tokens
        .slice(start, end)
        .every((t) => t.type !== 'inline' || t.content.trim() === '')
      if (empty) state.tokens.splice(start, end - start + 1)
    }
  })

  const rules = md.renderer.rules
  const renderWithStyle =
    (style: string) =>
    (tokens: Token[], idx: number, options: MarkdownIt.Options) => {
      tokens[idx].attrSet('style', style)
      return md.renderer.renderToken(tokens, idx, options)
    }

  rules.paragraph_open = renderWithStyle(EMAIL_STYLES.paragraph)
  rules.heading_open = renderWithStyle(EMAIL_STYLES.heading)
  rules.table_open = renderWithStyle(EMAIL_STYLES.table)

  rules.tr_open = (tokens, idx, options, env: RenderEnv) => {
    env.column = 0
    return md.renderer.renderToken(tokens, idx, options)
  }
  // First column is the label of a fact row.
  rules.td_open = (tokens, idx, options, env: RenderEnv) => {
    const style = env.column === 0 ? EMAIL_STYLES.labelCell : EMAIL_STYLES.cell
    env.column += 1
    tokens[idx].attrSet('style', style)
    return md.renderer.renderToken(tokens, idx, options)
  }
  rules.th_open = rules.td_open

  rules.link_open = (tokens, idx, options, env: RenderEnv) => {
    const token = tokens[idx]
    const isButton = token.attrGet('title') === BUTTON_TITLE
    if (isButton) {
      token.attrs = (token.attrs ?? []).filter(([name]) => name !== 'title')
    }
    token.attrSet(
      'href',
      fillUrl(token.attrGet('href') ?? '', env, LINK_PROTOCOL)
    )
    token.attrSet('style', isButton ? EMAIL_STYLES.button : EMAIL_STYLES.link)
    return md.renderer.renderToken(tokens, idx, options)
  }

  rules.image = (tokens, idx, options, env: RenderEnv) => {
    const token = tokens[idx]
    const src = fillUrl(token.attrGet('src') ?? '', env, IMAGE_PROTOCOL)
    const alt = md.renderer.renderInlineAsText(
      token.children ?? [],
      options,
      env
    )
    return (
      `<img src="${md.utils.escapeHtml(src)}" alt="${md.utils.escapeHtml(alt)}"` +
      ` width="${IMAGE_WIDTH}" style="${EMAIL_STYLES.image}">`
    )
  }

  return md
}

const md = createMarkdown()

// Plain-text rendering of the parsed tokens: blocks separated by a blank
// line, links as "text (url)", fact rows as "label: value", images skipped.
const inlineToText = (children: Token[], env: RenderEnv): string => {
  let out = ''
  let href: string | null = null
  let linkStart = 0
  for (const child of children) {
    switch (child.type) {
      case 'text':
      case 'code_inline':
        out += child.content
        break
      case 'softbreak':
      case 'hardbreak':
        out += '\n'
        break
      case 'link_open':
        href = fillUrl(child.attrGet('href') ?? '', env, LINK_PROTOCOL)
        linkStart = out.length
        break
      case 'link_close': {
        const linkText = fillSlots(out.slice(linkStart), env).trim()
        // mailto:/tel: and self-describing links read fine as their text.
        if (href && !/^(mailto:|tel:)/i.test(href) && linkText !== href) {
          out = `${out.trimEnd()} (${href})`
        }
        href = null
        break
      }
    }
  }
  return out
}

const tokensToText = (tokens: Token[], env: RenderEnv): string => {
  const blocks: string[] = []
  // A table is one block, one line per row.
  let tableRows: string[] | null = null
  let row: string[] | null = null
  for (const token of tokens) {
    if (token.type === 'table_open') tableRows = []
    else if (token.type === 'table_close' && tableRows) {
      blocks.push(tableRows.join('\n'))
      tableRows = null
    } else if (token.type === 'tr_open') row = []
    else if (token.type === 'tr_close' && row) {
      tableRows?.push(row.filter((cell) => cell !== '').join(': '))
      row = null
    } else if (token.type === 'inline') {
      const text = inlineToText(token.children ?? [], env)
      if (row) row.push(text.trim())
      else blocks.push(text)
    }
  }
  return blocks.filter((block) => block.trim() !== '').join('\n\n')
}

/**
 * Renders a markdown template to an inline-styled HTML fragment plus plain
 * text. Placeholders are filled after parsing: values are never read as
 * markdown, are HTML-escaped in `html`, and URL values are protocol-checked.
 */
export const renderMarkdown = (
  markdown: string,
  placeholders: Placeholders
): { html: string; text: string } => {
  assertNoMissing(markdown, placeholders)

  const names: string[] = []
  const protectedMarkdown = markdown.replace(TOKEN_RE, (_m, key: string) => {
    names.push(key)
    return `${names.length - 1}`
  })
  const env: RenderEnv = {
    names,
    values: names.map((name) => {
      const value = placeholders[name]
      // Slot characters in a value could otherwise pull in another value.
      return typeof value === 'string' ? value.replace(/[]/g, '') : value
    }),
    htmlBlocks: new Set(),
    column: 0,
  }

  const rendered = md.render(protectedMarkdown, env)
  const html = rendered
    .replace(SLOT_RE, (_m, i: string) => {
      const value = env.values[Number(i)]
      if (value instanceof TrustedHtml && env.htmlBlocks.has(Number(i))) {
        return value.html
      }
      return he.escape(textOf(value)).replace(/\r?\n/g, '<br>')
    })
    .trim()

  const text = fillSlots(
    tokensToText(
      md.parse(protectedMarkdown, { ...env, htmlBlocks: new Set() }),
      env
    ),
    env
  )

  return { html, text }
}
