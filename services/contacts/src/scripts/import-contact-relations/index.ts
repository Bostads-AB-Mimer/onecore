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
 * recipients, a CSV file ./contact-relations-conflicts-<timestamp>.csv in the
 * current working directory. Exit code 1 on failure; nothing is partially
 * written (single transaction).
 */
import fs from 'node:fs/promises'
import { logger } from '@onecore/utilities'
import config from '@src/common/config'
import { makeAppContext } from '@src/context'
import { ImportReport, runImport } from './import'
import { Conflict } from './collapse'

const parseArgs = (argv: string[]): { dryRun: boolean } => ({
  dryRun: argv.includes('--dry-run'),
})

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
  const { infrastructure } = makeAppContext(config)
  const { xpandDb, contactsDb } = infrastructure

  await Promise.all([xpandDb.init(), contactsDb.init()])
  try {
    const report = await runImport({
      xpandDb: xpandDb.get(),
      contactsDb: contactsDb.get(),
      dryRun,
    })
    logger.info({ report }, 'import-contact-relations: summary')
    process.stdout.write(`${formatReport(report)}\n`)

    if (report.conflicts.length > 0) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const file = `contact-relations-conflicts-${stamp}.csv`
      await fs.writeFile(file, `${conflictsCsv(report.conflicts)}\n`, 'utf8')
      process.stdout.write(`Konflikter skrivna till ${file}\n`)
    }
  } finally {
    await Promise.all([xpandDb.close(), contactsDb.close()])
  }
}

main().catch((err) => {
  logger.error({ err }, 'import-contact-relations failed')
  process.exitCode = 1
})
