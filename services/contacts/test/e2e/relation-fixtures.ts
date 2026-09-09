import { RelationEdge } from '@src/adapters/contact-relations'

/**
 * `contact_relation` rows seeded before every e2e run. They mirror the
 * guardian / ANNANFM fixtures in `.jest/sql/seed.sql` so existing e2e
 * assertions hold after the read flip. Names still come from the Xpand seed.
 */
export const RELATION_FIXTURES: RelationEdge[] = [
  {
    subjectContactCode: 'P000555',
    relatedContactCode: 'P000444',
    roleType: 'forvaltare',
  },
  {
    subjectContactCode: 'P000666',
    relatedContactCode: 'P000444',
    roleType: 'god_man',
  },
  {
    subjectContactCode: 'P000777',
    relatedContactCode: 'P000888',
    roleType: 'forvaltare',
  },
  {
    subjectContactCode: 'P000999',
    relatedContactCode: 'P000777',
    roleType: 'forvaltare',
  },
  {
    subjectContactCode: 'P900001',
    relatedContactCode: 'P900010',
    roleType: 'annan_fakturamottagare',
  },
  // Stored twice on purpose: there is no unique index on active edges yet,
  // and the read path must collapse duplicates.
  {
    subjectContactCode: 'P900001',
    relatedContactCode: 'P900010',
    roleType: 'annan_fakturamottagare',
  },
  {
    subjectContactCode: 'P900004',
    relatedContactCode: 'P000888',
    roleType: 'annan_fakturamottagare',
  },
  {
    subjectContactCode: 'P900005',
    relatedContactCode: 'P900013',
    roleType: 'annan_fakturamottagare',
  },
]

/**
 * Soft-deleted rows: must never surface. P900002 ↔ P900011 used to be a
 * terminated-lease case in the Xpand-backed tests; it now proves the
 * `deleted_at IS NULL` filter.
 */
export const SOFT_DELETED_RELATION_FIXTURES: RelationEdge[] = [
  {
    subjectContactCode: 'P900002',
    relatedContactCode: 'P900011',
    roleType: 'annan_fakturamottagare',
  },
]
