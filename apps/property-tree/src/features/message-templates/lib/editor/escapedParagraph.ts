import { Paragraph } from '@tiptap/extension-paragraph'

// Text at a line start that markdown would read as a heading, quote, list,
// rule, setext underline or fence. "*" is left out: the writer already
// escapes a literal one, and a bare one starts bold.
const BLOCK_START = /^( {0,3})([#>+=~-])/
const ORDERED_START = /^( {0,3}\d{1,9})([.)])/

/** Escapes block markers at every line start, so text stays text. */
export const escapeLineStarts = (markdown: string) =>
  markdown
    .split('\n')
    .map((line) =>
      line.replace(BLOCK_START, '$1\\$2').replace(ORDERED_START, '$1\\$2')
    )
    .join('\n')

// renderMarkdown gets no this.parent, so the stock writer is called directly.
const stockRenderMarkdown = Paragraph.config.renderMarkdown

/**
 * The stock writer escapes markdown inside a line but not at its start, so
 * a paragraph typed as "1. Ta med" or "# 5" came back as a list or heading.
 */
export const EscapedParagraph = Paragraph.extend({
  renderMarkdown: (node, helpers, ctx) =>
    escapeLineStarts(
      stockRenderMarkdown
        ? stockRenderMarkdown(node, helpers, ctx)
        : helpers.renderChildren(node.content ?? [])
    ),
})
