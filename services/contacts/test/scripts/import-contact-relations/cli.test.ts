import {
  conflictsCsv,
  conflictsFileName,
  formatReport,
  formatTargets,
  parseArgs,
} from '@src/scripts/import-contact-relations/cli'
import { ImportReport } from '@src/scripts/import-contact-relations/import'

const report = (overrides: Partial<ImportReport> = {}): ImportReport => ({
  dryRun: false,
  desired: { god_man: 3, forvaltare: 2, annan_fakturamottagare: 1 },
  inserted: 4,
  softDeleted: 1,
  unchanged: 2,
  protected: 0,
  conflicts: [],
  skippedGuardians: [],
  ...overrides,
})

describe('parseArgs', () => {
  it('defaults to a writing run', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, force: false })
  })

  it('accepts --dry-run and --force in any order', () => {
    expect(parseArgs(['--force', '--dry-run'])).toEqual({
      dryRun: true,
      force: true,
    })
  })

  it('rejects unknown arguments', () => {
    expect(() => parseArgs(['--dryrun'])).toThrow('Unknown argument(s)')
  })
})

describe('formatTargets', () => {
  it('names both databases so a wrong target is visible before writing', () => {
    const text = formatTargets(
      { host: 'xpand.example', database: 'TEST_21_DB' },
      { host: 'contacts.example', database: 'contacts' }
    )

    expect(text).toContain('xpand.example/TEST_21_DB')
    expect(text).toContain('contacts.example/contacts')
  })
})

describe('formatReport', () => {
  it('reports the counts, and marks a dry run', () => {
    expect(formatReport(report({ dryRun: true }))).toContain('DRY RUN')
    expect(formatReport(report())).not.toContain('DRY RUN')
    expect(formatReport(report())).toContain('Nya rader:             4')
  })

  it('lists conflicting holders with their recipients', () => {
    const text = formatReport(
      report({
        conflicts: [
          {
            holderContactCode: 'P1',
            recipients: [
              { contactCode: 'P8', leaseIds: ['L1'] },
              { contactCode: 'P9', leaseIds: ['L2', 'L3'] },
            ],
          },
        ],
      })
    )

    expect(text).toContain('P1:')
    expect(text).toContain('P9  (avtal L2, L3)')
  })

  it('lists guardians kept because someone else set them', () => {
    const text = formatReport(
      report({
        skippedGuardians: [
          {
            subjectContactCode: 'P1',
            desired: {
              subjectContactCode: 'P1',
              relatedContactCode: 'P2',
              roleType: 'god_man',
            },
            existing: {
              relatedContactCode: 'P3',
              roleType: 'forvaltare',
              createdBy: 'manual-admin',
            },
          },
        ],
      })
    )

    expect(text).toContain('Överhoppade gode män/förvaltare: 1')
    expect(text).toContain(
      '  P1: Xpand säger god man P2 — behåller förvaltare P3 (satt av manual-admin)'
    )
  })
})

describe('conflictsCsv', () => {
  it('writes one row per recipient with semicolon-separated leases', () => {
    expect(
      conflictsCsv([
        {
          holderContactCode: 'P1',
          recipients: [{ contactCode: 'P9', leaseIds: ['L1', 'L2'] }],
        },
      ])
    ).toEqual(
      [
        'holder_contact_code,recipient_contact_code,lease_ids',
        'P1,P9,L1;L2',
      ].join('\n')
    )
  })
})

describe('conflictsFileName', () => {
  it('marks dry-run output so it cannot be mistaken for a written run', () => {
    const now = new Date('2026-09-08T10:11:12.500Z')

    expect(conflictsFileName(now, false)).toEqual(
      'contact-relations-conflicts-2026-09-08T10-11-12-500Z.csv'
    )
    expect(conflictsFileName(now, true)).toContain('conflicts-dry-run-')
  })
})
