import { type Resource, logger } from '@onecore/utilities'
import knex from 'knex'

import {
  ContactCategoryWriter,
  convertedContactCode,
} from '@src/adapters/contact-category-writer'
import { ContactCategory } from '@src/domain/contact'

/**
 * `cmctk.keycmctk` for each organisation category.
 *
 * Copied verbatim from the `cmctk` table — verified identical in production
 * and test on 2026-09-09. Six of the seven categories follow the pattern
 * `_0EI00000<letter>`, but Ö does not: its key uses a plain latin O. The map
 * therefore must never be derived from the category letter; add a category
 * only by reading its key from the table.
 */
const CATEGORY_KEYS: Record<ContactCategory, string> = {
  F: '_0EI00000F',
  I: '_0EI00000I',
  K: '_0EI00000K',
  L: '_0EI00000L',
  Ö: '_0EI00000O',
  S: '_0EI00000S',
}

/**
 * A `ContactCategoryWriter` that updates `cmctc` in the Xpand database.
 *
 * Runs on the same connection the read side uses; the database user needs
 * UPDATE on `cmctc`, which is a deployment-checklist item per environment.
 */
export const xpandContactCategoryWriter = (
  db: Resource<knex.Knex>
): ContactCategoryWriter => ({
  convertToOrganisation: async ({ contactCode, category, name }) => {
    const categoryKey = CATEGORY_KEYS[category]
    if (!categoryKey) {
      return { ok: false, err: 'unsupported-category', detail: category }
    }

    const targetCode = convertedContactCode(contactCode, category)
    if (!targetCode) {
      return { ok: false, err: 'contact-not-found', detail: contactCode }
    }

    try {
      const xpand = db.get()

      // One conditional statement rather than a select-then-update: the code
      // has a unique index, so the affected-row count says whether the person
      // row was there, and there is no window in which it can change under us.
      const updated = await xpand('cmctc')
        .where('cmctckod', contactCode)
        .update({
          keycmctk: categoryKey,
          cmctcben: name,
          fnamn: null,
          enamn: null,
          birthdate: null,
          cmctckod: targetCode,
        })

      if (updated === 1) {
        return { ok: true, data: { contactCode: targetCode } }
      }

      // Nothing to update: either a previous attempt already converted the
      // contact, or the code never existed.
      const converted = await xpand('cmctc')
        .select('cmctckod')
        .where('cmctckod', targetCode)
        .first()

      return converted
        ? { ok: false, err: 'already-converted', detail: targetCode }
        : { ok: false, err: 'contact-not-found', detail: contactCode }
    } catch (err) {
      logger.error(
        { err, contactCode, targetCode, category },
        'contactCategoryWriter.convertToOrganisation'
      )
      return { ok: false, err: 'xpand-db-error' }
    }
  },
})
