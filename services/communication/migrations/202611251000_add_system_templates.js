const fs = require('node:fs')
const path = require('node:path')

// Frozen seed data: later wording changes go in a new migration (until there
// is an editor), so this one stays reproducible.
const SEED_DIR = path.join(__dirname, 'system-email-templates')

const readSeeds = () =>
  JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'index.json'), 'utf8')).map(
    (entry) => ({
      ...entry,
      body: fs.readFileSync(
        path.join(SEED_DIR, `${entry.systemKey}.md`),
        'utf8'
      ),
    })
  )

/**
 * System templates: emails the code sends by `systemKey` (ids differ per
 * environment). The message-template routes never return these rows, and a
 * rep template may reuse a system template's name.
 *
 * One statement per batch: MSSQL compiles a batch before running it, so an
 * index on `systemKey` in the same batch as the ALTER fails.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  // Read before any DDL, so a missing seed file fails before the schema changes.
  const seeds = readSeeds()
  return knex.transaction(async (trx) => {
    await trx.raw(`ALTER TABLE template ADD systemKey NVARCHAR(100) NULL;`)
    await trx.raw(`
      CREATE UNIQUE INDEX uq_template_system_key
        ON template(systemKey) WHERE systemKey IS NOT NULL;
    `)
    await trx.raw(`DROP INDEX IF EXISTS uq_template_active_name ON template;`)
    await trx.raw(`
      CREATE UNIQUE INDEX uq_template_active_name
        ON template(name) WHERE isActive = 1 AND systemKey IS NULL;
    `)
    await trx('template').insert(
      seeds.map((seed) => ({
        name: seed.name,
        systemKey: seed.systemKey,
        channels: 'email',
        subject: seed.subject,
        body: seed.body,
        categories: null,
        isActive: true,
      }))
    )
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.transaction(async (trx) => {
    await trx.raw(`DELETE FROM template WHERE systemKey IS NOT NULL;`)
    await trx.raw(`DROP INDEX IF EXISTS uq_template_active_name ON template;`)
    await trx.raw(`
      CREATE UNIQUE INDEX uq_template_active_name
        ON template(name) WHERE isActive = 1;
    `)
    await trx.raw(`DROP INDEX IF EXISTS uq_template_system_key ON template;`)
    await trx.raw(`ALTER TABLE template DROP COLUMN systemKey;`)
  })
}
