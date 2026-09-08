/**
 * import-contact-relations
 *
 * One-shot / rerunnable import of god man, förvaltare and annan
 * fakturamottagare relations from Xpand into the contacts database
 * (`contact_relation`). Run locally; Xpand is only read.
 *
 * Setup: point services/contacts/.env at the databases you intend to use —
 *   XPAND_DATABASE__*      the Xpand database to read from
 *   CONTACTS_DATABASE__*   the contacts database to write to
 *
 * Usage (from services/contacts):
 *   pnpm dev:script:import-contact-relations --dry-run   # report only
 *   pnpm dev:script:import-contact-relations             # write
 *
 * Output: a summary on stdout and, when there are holders with conflicting
 * recipients, a CSV file ./contact-relations-conflicts-<timestamp>.csv (or
 * ./contact-relations-conflicts-dry-run-<timestamp>.csv in --dry-run mode) in
 * the current working directory — written in dry-run mode too, since it
 * doesn't touch contact_relation. Exit code 1 on failure; nothing is
 * partially written (single transaction).
 */
import fs from 'node:fs/promises'
import knex, { Knex } from 'knex'
import { KnexConnectionParameters, logger } from '@onecore/utilities'
import config from '@src/common/config'
import { ImportReport, runImport } from './import'
import { Conflict } from './collapse'

const USAGE = 'Usage: pnpm dev:script:import-contact-relations [--dry-run]'

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

const parseArgs = (argv: string[]): { dryRun: boolean } => {
  const unknown = argv.filter((a) => a !== '--dry-run')
  if (unknown.length > 0) {
    throw new Error(`Unknown argument(s): ${unknown.join(' ')}\n${USAGE}`)
  }
  return { dryRun: argv.includes('--dry-run') }
}

const formatReport = (report: ImportReport): string =>
  [
    `import-contact-relations${report.dryRun ? ' (DRY RUN — inget skrivet)' : ''}`,
    `Relationer i Xpand:    god man ${report.desired.god_man}, förvaltare ${report.desired.forvaltare}, annan fakturamottagare ${report.desired.annan_fakturamottagare}`,
    `Nya rader:             ${report.inserted}`,
    `Borttagna (soft):      ${report.softDeleted}`,
    `Oförändrade:           ${report.unchanged}`,
    `Skyddade (konflikt):   ${report.protected}`,
    `Konflikter:            ${report.conflicts.length}`,
    ...report.conflicts.flatMap((c) => [
      `  ${c.holderContactCode}:`,
      ...c.recipients.map(
        (r) => `    ${r.contactCode}  (avtal ${r.leaseIds.join(', ')})`
      ),
    ]),
  ].join('\n')

const conflictsCsv = (conflicts: Conflict[]): string =>
  [
    'holder_contact_code,recipient_contact_code,lease_ids',
    ...conflicts.flatMap((c) =>
      c.recipients.map(
        (r) => `${c.holderContactCode},${r.contactCode},${r.leaseIds.join(';')}`
      )
    ),
  ].join('\n')

const main = async () => {
  const { dryRun } = parseArgs(process.argv.slice(2))

  let xpandDb: Knex | undefined
  let contactsDb: Knex | undefined
  try {
    xpandDb = connect(config.xpandDatabase)
    contactsDb = connect(config.contactsDatabase)

    const report = await runImport({
      xpandDb,
      contactsDb,
      dryRun,
    })
    logger.info({ report }, 'import-contact-relations: summary')
    process.stdout.write(`${formatReport(report)}\n`)

    if (report.conflicts.length > 0) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const file = `contact-relations-conflicts-${dryRun ? 'dry-run-' : ''}${stamp}.csv`
      await fs.writeFile(file, `${conflictsCsv(report.conflicts)}\n`, 'utf8')
      process.stdout.write(`Konflikter skrivna till ${file}\n`)
    }
  } finally {
    // allSettled: a teardown failure must not replace the import's own error.
    await Promise.allSettled([xpandDb?.destroy(), contactsDb?.destroy()])
  }
}

main().catch((err) => {
  logger.error({ err }, 'import-contact-relations failed')
  process.exitCode = 1
})
