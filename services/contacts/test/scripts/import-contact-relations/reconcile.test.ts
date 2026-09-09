import { reconcile } from '@src/scripts/import-contact-relations/reconcile'
import { IMPORT_ACTOR } from '@src/scripts/import-contact-relations/import'
import { RelationEdge } from '@src/adapters/contact-relations'
import * as factory from '../../factories'

const OTHER_ACTOR = 'manual-admin'

const row = (
  id: string,
  edge: RelationEdge,
  overrides: { createdBy?: string; createdAt?: Date } = {}
) =>
  factory.dbContactRelationRow.build({
    id,
    subject_contact_code: edge.subjectContactCode,
    related_contact_code: edge.relatedContactCode,
    role_type: edge.roleType,
    created_by: overrides.createdBy ?? IMPORT_ACTOR,
    created_at: overrides.createdAt ?? new Date('2026-09-01T00:00:00Z'),
  })

const godMan: RelationEdge = {
  subjectContactCode: 'P1',
  relatedContactCode: 'P2',
  roleType: 'god_man',
}
const forvaltare: RelationEdge = {
  subjectContactCode: 'P3',
  relatedContactCode: 'P4',
  roleType: 'forvaltare',
}
const recipient: RelationEdge = {
  subjectContactCode: 'P5',
  relatedContactCode: 'P6',
  roleType: 'annan_fakturamottagare',
}

describe('reconcile', () => {
  it('inserts everything when nothing exists', () => {
    const plan = reconcile([godMan, forvaltare], [], new Set(), IMPORT_ACTOR)
    expect(plan).toEqual({
      toInsert: [godMan, forvaltare],
      toDelete: [],
      unchangedCount: 0,
      protectedCount: 0,
    })
  })

  it('is a no-op when desired equals existing', () => {
    const plan = reconcile(
      [godMan, forvaltare],
      [row('a', godMan), row('b', forvaltare)],
      new Set(),
      IMPORT_ACTOR
    )
    expect(plan).toEqual({
      toInsert: [],
      toDelete: [],
      unchangedCount: 2,
      protectedCount: 0,
    })
  })

  it('soft-deletes import-owned rows that are no longer desired', () => {
    const plan = reconcile(
      [godMan],
      [row('a', godMan), row('b', forvaltare)],
      new Set(),
      IMPORT_ACTOR
    )
    expect(plan).toEqual({
      toInsert: [],
      toDelete: ['b'],
      unchangedCount: 1,
      protectedCount: 0,
    })
  })

  it('treats a changed role for the same pair as delete + insert', () => {
    const changed: RelationEdge = { ...godMan, roleType: 'forvaltare' }
    const plan = reconcile(
      [changed],
      [row('a', godMan)],
      new Set(),
      IMPORT_ACTOR
    )
    expect(plan).toEqual({
      toInsert: [changed],
      toDelete: ['a'],
      unchangedCount: 0,
      protectedCount: 0,
    })
  })

  it('never deletes fakturamottagare rows for a conflict holder', () => {
    const plan = reconcile(
      [],
      [row('a', recipient)],
      new Set(['P5']),
      IMPORT_ACTOR
    )
    expect(plan).toEqual({
      toInsert: [],
      toDelete: [],
      unchangedCount: 0,
      protectedCount: 1,
    })
  })

  it('still deletes guardian rows for a conflict holder', () => {
    const guardianOfP5: RelationEdge = {
      subjectContactCode: 'P5',
      relatedContactCode: 'P7',
      roleType: 'god_man',
    }
    const plan = reconcile(
      [],
      [row('a', guardianOfP5)],
      new Set(['P5']),
      IMPORT_ACTOR
    )
    expect(plan).toEqual({
      toInsert: [],
      toDelete: ['a'],
      unchangedCount: 0,
      protectedCount: 0,
    })
  })

  it('dedupes desired edges before inserting', () => {
    const plan = reconcile([godMan, godMan], [], new Set(), IMPORT_ACTOR)
    expect(plan.toInsert).toEqual([godMan])
  })

  it('does not collide keys that share a separator-like substring', () => {
    const a: RelationEdge = {
      subjectContactCode: 'A|B',
      relatedContactCode: 'C',
      roleType: 'god_man',
    }
    const b: RelationEdge = {
      subjectContactCode: 'A',
      relatedContactCode: 'B|C',
      roleType: 'god_man',
    }
    const plan = reconcile([a, b], [], new Set(), IMPORT_ACTOR)
    expect(plan.toInsert).toHaveLength(2)
  })

  it('soft-deletes duplicate import-owned rows for a desired key, keeping the oldest', () => {
    const plan = reconcile(
      [godMan],
      [
        row('newer', godMan, { createdAt: new Date('2026-09-02T00:00:00Z') }),
        row('oldest', godMan, { createdAt: new Date('2026-09-01T00:00:00Z') }),
        row('newest', godMan, { createdAt: new Date('2026-09-03T00:00:00Z') }),
      ],
      new Set(),
      IMPORT_ACTOR
    )
    expect(plan).toEqual({
      toInsert: [],
      toDelete: ['newer', 'newest'],
      unchangedCount: 1,
      protectedCount: 0,
    })
  })

  it('does not insert a desired edge that already exists as a row owned by another actor', () => {
    const plan = reconcile(
      [godMan],
      [row('a', godMan, { createdBy: OTHER_ACTOR })],
      new Set(),
      IMPORT_ACTOR
    )
    expect(plan).toEqual({
      toInsert: [],
      toDelete: [],
      unchangedCount: 1,
      protectedCount: 0,
    })
  })

  it('soft-deletes an import-owned row that duplicates a row owned by another actor', () => {
    const plan = reconcile(
      [godMan],
      [row('manual', godMan, { createdBy: OTHER_ACTOR }), row('mine', godMan)],
      new Set(),
      IMPORT_ACTOR
    )
    expect(plan).toEqual({
      toInsert: [],
      toDelete: ['mine'],
      unchangedCount: 1,
      protectedCount: 0,
    })
  })

  it('leaves an undesired row owned by another actor untouched and uncounted', () => {
    const plan = reconcile(
      [],
      [row('a', godMan, { createdBy: OTHER_ACTOR })],
      new Set(),
      IMPORT_ACTOR
    )
    expect(plan).toEqual({
      toInsert: [],
      toDelete: [],
      unchangedCount: 0,
      protectedCount: 0,
    })
  })

  it('does not count a conflict-holder row owned by another actor as protected', () => {
    const plan = reconcile(
      [],
      [row('a', recipient, { createdBy: OTHER_ACTOR })],
      new Set(['P5']),
      IMPORT_ACTOR
    )
    expect(plan).toEqual({
      toInsert: [],
      toDelete: [],
      unchangedCount: 0,
      protectedCount: 0,
    })
  })
})
