// Subheadings were seeded as bold text: "Om bilplatsen" as its own paragraph
// (a ## heading), the others as a bold first line above their text in the
// approved parking space email (### subheadings). Teal, like the old Infobip
// templates. Only these exact texts at a paragraph start change.
const OWN_PARAGRAPH = ['Om bilplatsen']
const FIRST_LINE = ['Kontraktet', 'Betala hyran', 'Eventuella nycklar']
const TITLES = [...OWN_PARAGRAPH, ...FIRST_LINE].join('|')

const BOLD = new RegExp(`(^|\\n\\n)\\*\\*(${TITLES})\\*\\*(\\n\\n|\\n|$)`, 'g')
const HEADING = new RegExp(`(^|\\n\\n)###? (${TITLES})(\\n\\n|$)`, 'g')

const marker = (title) => (OWN_PARAGRAPH.includes(title) ? '##' : '###')

const toHeading = (_match, before, title, after) =>
  `${before}${marker(title)} ${title}${after === '' ? '' : '\n\n'}`

const toBold = (_match, before, title, after) => {
  if (after === '') return `${before}**${title}**`
  return `${before}**${title}**${OWN_PARAGRAPH.includes(title) ? '\n\n' : '\n'}`
}

const toHeadings = (body) => body.replace(BOLD, toHeading)
const toBoldText = (body) => body.replace(HEADING, toBold)

const rewrite = async (knex, convert) => {
  const rows = await knex('template')
    .whereNotNull('systemKey')
    .select('id', 'body')
  for (const row of rows) {
    const body = convert(row.body)
    if (body !== row.body) {
      // revision + 1: an editor open on the old text must not save over this.
      await knex('template')
        .where('id', row.id)
        .update({ body, revision: knex.raw('revision + 1') })
    }
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction((trx) => rewrite(trx, toHeadings))
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction((trx) => rewrite(trx, toBoldText))
}

// Exported for their test; knex only reads up/down.
exports.toHeadings = toHeadings
exports.toBoldText = toBoldText
