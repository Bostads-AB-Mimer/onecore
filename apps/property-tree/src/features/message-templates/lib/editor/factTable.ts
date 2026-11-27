import { renderTableToMarkdown, Table } from '@tiptap/extension-table'

const BACKSLASH = '\\'
// The stock writer joins a cell's paragraphs and line breaks with "<br>";
// one typed as text is escaped ("\<br>"), so only the writer's own match.
const WRITER_BREAK = /(?<!\\)<br>/g

// A fact cell is one line. A line break would come out as a literal "<br>"
// (the renderer has html off) and an unescaped "|" splits the cell.
export const flattenCell = (markdown: string) =>
  markdown
    .split(`  \n`)
    .join(' ')
    .split(`${BACKSLASH}\n`)
    .join(' ')
    .split('\n')
    .join(' ')
    .split('|')
    .join(`${BACKSLASH}|`)

/**
 * Table whose markdown writer keeps every cell on one line. Enter moves to
 * the next cell and adds a row after the last one, so a fact row is typed
 * label, Enter, value, Enter.
 */
export const FactTable = Table.extend({
  renderMarkdown: (node, helpers) =>
    renderTableToMarkdown(node, {
      ...helpers,
      renderChildren: (nodes, separator) =>
        flattenCell(helpers.renderChildren(nodes, separator)),
    }).replace(WRITER_BREAK, ' '),

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Enter: () => {
        if (!this.editor.isActive('table')) return false
        if (this.editor.commands.goToNextCell()) return true
        return this.editor.chain().addRowAfter().goToNextCell().run()
      },
    }
  },
})
