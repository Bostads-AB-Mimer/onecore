import { Mark, mergeAttributes } from '@tiptap/react'
import type { MarkType, Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'

// Same token syntax as the backend renderer: {{token}}, inner spaces allowed.
const TOKEN = /^\{\{\s*(\w+)\s*\}\}/

export const PLACEHOLDER_MARK = 'placeholder'

export const placeholderText = (token: string) => `{{${token}}}`

type PlaceholderRange = {
  from: number
  to: number
  token: string
  text: string
}

// Adjacent text nodes carrying the same token (e.g. split by a bold mark) are
// one placeholder.
export const placeholderRanges = (
  doc: ProseMirrorNode,
  type: MarkType
): PlaceholderRange[] => {
  const ranges: PlaceholderRange[] = []
  doc.descendants((node, pos) => {
    const mark = node.isText ? type.isInSet(node.marks) : undefined
    if (!mark) return
    const token = String(mark.attrs.token)
    const last = ranges[ranges.length - 1]
    if (last && last.to === pos && last.token === token) {
      last.to = pos + node.nodeSize
      last.text += node.text ?? ''
    } else {
      ranges.push({
        from: pos,
        to: pos + node.nodeSize,
        token,
        text: node.text ?? '',
      })
    }
  })
  return ranges
}

/**
 * Keeps a placeholder whole: typing inside it is blocked, backspace/delete
 * next to it removes all of it, and a mark left on text that is no longer
 * exactly its token is narrowed to the token (or dropped).
 */
const placeholderGuard = (type: MarkType) =>
  new Plugin({
    key: new PluginKey('placeholderGuard'),
    props: {
      handleTextInput(view, from, to) {
        return placeholderRanges(view.state.doc, type).some(
          (r) => from < r.to && to > r.from && (from > r.from || to < r.to)
        )
      },
      handleKeyDown(view, event) {
        if (event.key !== 'Backspace' && event.key !== 'Delete') return false
        const { empty, from } = view.state.selection
        if (!empty) return false
        const hit = placeholderRanges(view.state.doc, type).find((r) =>
          event.key === 'Backspace'
            ? from > r.from && from <= r.to
            : from >= r.from && from < r.to
        )
        if (!hit) return false
        view.dispatch(view.state.tr.delete(hit.from, hit.to))
        return true
      },
    },
    appendTransaction(transactions, _oldState, state) {
      if (!transactions.some((tr) => tr.docChanged)) return null
      let fix: Transaction | null = null
      for (const r of placeholderRanges(state.doc, type)) {
        const whole = placeholderText(r.token)
        if (r.text === whole) continue
        fix ??= state.tr
        // Mark changes never move positions, so the ranges stay valid.
        fix.removeMark(r.from, r.to, type)
        const at = r.text.indexOf(whole)
        if (at >= 0) {
          fix.addMark(
            r.from + at,
            r.from + at + whole.length,
            type.create({ token: r.token })
          )
        }
      }
      return fix
    },
  })

export interface PlaceholderMarkOptions {
  labels: Record<string, string> // token -> Swedish name, shown as a tooltip
}

/**
 * A placeholder is a mark on the literal text "{{token}}", not an atom node:
 * as a node, bold and links around it were lost on the markdown round trip.
 */
export const PlaceholderMark = Mark.create<PlaceholderMarkOptions>({
  name: PLACEHOLDER_MARK,
  inclusive: false,
  excludes: '',

  addOptions: () => ({ labels: {} }),

  addAttributes: () => ({
    token: {
      default: '',
      parseHTML: (element) => element.getAttribute('data-token') ?? '',
      renderHTML: (attributes) => ({ 'data-token': attributes.token }),
    },
  }),

  parseHTML: () => [{ tag: 'span[data-token]' }],

  renderHTML({ mark, HTMLAttributes }) {
    const label = this.options.labels[String(mark.attrs.token)]
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'template-placeholder',
        ...(label ? { title: label } : {}),
      }),
      0,
    ]
  },

  markdownTokenName: PLACEHOLDER_MARK,
  markdownTokenizer: {
    name: PLACEHOLDER_MARK,
    level: 'inline',
    start: (src) => src.indexOf('{{'),
    tokenize: (src) => {
      const match = TOKEN.exec(src)
      if (!match) return undefined
      return { type: PLACEHOLDER_MARK, raw: match[0], token: match[1] }
    },
  },
  parseMarkdown: (token, helpers) => {
    const name = String(token.token)
    return helpers.applyMark(
      PLACEHOLDER_MARK,
      [helpers.createTextNode(placeholderText(name))],
      { token: name }
    )
  },
  renderMarkdown: (node, helpers) => helpers.renderChildren(node),

  addProseMirrorPlugins() {
    return [placeholderGuard(this.type)]
  },
})
