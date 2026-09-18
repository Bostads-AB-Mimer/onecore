import { KnexConnectionParameters } from '@onecore/utilities'
import { RoleType } from '@src/adapters/contact-relations'
import { ImportReport } from './import'
import { Conflict } from './collapse'

export const USAGE =
  'Usage: pnpm dev:script:import-contact-relations [--dry-run] [--force]'

export type Options = { dryRun: boolean; force: boolean }

const FLAGS = ['--dry-run', '--force']

export const parseArgs = (argv: string[]): Options => {
  const unknown = argv.filter((a) => !FLAGS.includes(a))
  if (unknown.length > 0) {
    throw new Error(`Unknown argument(s): ${unknown.join(' ')}\n${USAGE}`)
  }
  return {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
  }
}

/** Printed before any write, so a wrong .env is visible while it still is. */
export const formatTargets = (
  xpand: Pick<KnexConnectionParameters, 'host' | 'database'>,
  contacts: Pick<KnexConnectionParameters, 'host' | 'database'>
): string =>
  [
    `Läser från Xpand:      ${xpand.host}/${xpand.database}`,
    `Skriver till contacts: ${contacts.host}/${contacts.database}`,
  ].join('\n')

const ROLE_LABELS: Record<RoleType, string> = {
  god_man: 'god man',
  forvaltare: 'förvaltare',
  annan_fakturamottagare: 'annan fakturamottagare',
}

export const formatReport = (report: ImportReport): string =>
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
    `Överhoppade:           ${report.skippedGuardians.length}`,
    ...report.skippedGuardians.map(
      (s) =>
        `  ${s.subjectContactCode}: Xpand säger ${ROLE_LABELS[s.desired.roleType]} ${s.desired.relatedContactCode}` +
        ` — behåller ${ROLE_LABELS[s.existing.roleType]} ${s.existing.relatedContactCode} (satt av ${s.existing.createdBy})`
    ),
  ].join('\n')

export const conflictsCsv = (conflicts: Conflict[]): string =>
  [
    'holder_contact_code,recipient_contact_code,lease_ids',
    ...conflicts.flatMap((c) =>
      c.recipients.map(
        (r) => `${c.holderContactCode},${r.contactCode},${r.leaseIds.join(';')}`
      )
    ),
  ].join('\n')

export const conflictsFileName = (now: Date, dryRun: boolean): string => {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  return `contact-relations-conflicts-${dryRun ? 'dry-run-' : ''}${stamp}.csv`
}
