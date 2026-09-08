/**
 * import-contact-relations
 *
 * Rerunnable import of god man, förvaltare and annan fakturamottagare
 * relations from Xpand into the contacts database. Run locally; Xpand is only
 * read.
 *
 * Setup: point services/contacts/.env at the databases you intend to use —
 *   XPAND_DATABASE__*      the Xpand database to read from
 *   CONTACTS_DATABASE__*   the contacts database to write to
 *
 * Usage (from services/contacts):
 *   pnpm dev:script:import-contact-relations --dry-run   # report only
 *   pnpm dev:script:import-contact-relations             # write
 *   pnpm dev:script:import-contact-relations --force     # allow a mass delete
 *
 * Conflicting holders are written to ./contact-relations-conflicts-<ts>.csv in
 * the current working directory — in dry-run mode too, since that touches
 * nothing.
 */
import fs from 'node:fs/promises'
import knex, { Knex } from 'knex'
import { KnexConnectionParameters, logger } from '@onecore/utilities'
import config from '@src/common/config'
import { runImport } from './import'
import {
  conflictsCsv,
  conflictsFileName,
  formatReport,
  formatTargets,
  parseArgs,
} from './cli'

// Plain, one-shot knex instances rather than the app's Resource wrapper: a
// Resource whose init() throws skips its own finally (the other resource's
// healthcheck interval and the failed one's forever-retrying heal timer keep
// the process alive after "failed" is logged), and a healthcheck blip during
// a long run would call knex.destroy() out from under the running
// transaction. Neither is appropriate for a script that runs once and exits.
const connect = (params: KnexConnectionParameters): Knex =>
  knex({
    client: 'mssql',
    connection: {
      host: params.host,
      user: params.user,
      password: params.password,
      port: Number(params.port),
      database: params.database,
    },
    pool: { min: 1, max: 5 },
  })

const main = async () => {
  const { dryRun, force } = parseArgs(process.argv.slice(2))

  let xpandDb: Knex | undefined
  let contactsDb: Knex | undefined
  try {
    process.stdout.write(
      `${formatTargets(config.xpandDatabase, config.contactsDatabase)}\n\n`
    )
    xpandDb = connect(config.xpandDatabase)
    contactsDb = connect(config.contactsDatabase)

    const report = await runImport({ xpandDb, contactsDb, dryRun, force })
    logger.info({ report }, 'importContactRelations.summary')
    process.stdout.write(`${formatReport(report)}\n`)

    if (report.conflicts.length > 0) {
      const file = conflictsFileName(new Date(), dryRun)
      // The import already committed; conflicts are on stdout either way, so a
      // failed CSV write must not report the run itself as failed.
      try {
        await fs.writeFile(file, `${conflictsCsv(report.conflicts)}\n`, 'utf8')
        process.stdout.write(`Konflikter skrivna till ${file}\n`)
      } catch (err) {
        logger.warn({ err, file }, 'importContactRelations.conflictsCsvFailed')
        process.stdout.write(`Kunde inte skriva ${file} — se listan ovan\n`)
      }
    }
  } finally {
    // allSettled: a teardown failure must not replace the import's own error.
    await Promise.allSettled([xpandDb?.destroy(), contactsDb?.destroy()])
  }
}

main().catch((err) => {
  logger.error({ err }, 'importContactRelations.failed')
  process.exitCode = 1
})
