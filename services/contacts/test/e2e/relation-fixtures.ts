import { RelationEdge } from '@src/adapters/contact-relations'

/**
 * `contact_relation` rows seeded before every e2e run, mirroring the guardian
 * / ANNANFM fixtures in `.jest/sql/seed.sql`. Names come from the Xpand seed.
 * Active edges are unique since migration 202609101000, so no edge is
 * repeated here; the read path's dedupe is defensive only.
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
 * Seeded soft-deleted: must never surface from either side. Present in every
 * e2e run, so every relation assertion in the suite also stands as proof that
 * the `deleted_at IS NULL` filter holds.
 */
export const SOFT_DELETED_RELATION_FIXTURES: RelationEdge[] = [
  {
    subjectContactCode: 'P900002',
    relatedContactCode: 'P900011',
    roleType: 'annan_fakturamottagare',
  },
]
