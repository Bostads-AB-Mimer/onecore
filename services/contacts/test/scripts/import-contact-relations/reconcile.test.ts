import { reconcile } from '@src/scripts/import-contact-relations/reconcile'
import {
  DbContactRelationRow,
  RelationEdge,
} from '@src/adapters/contact-relations'

const row = (id: string, edge: RelationEdge): DbContactRelationRow => ({
  id,
  subject_contact_code: edge.subjectContactCode,
  related_contact_code: edge.relatedContactCode,
  role_type: edge.roleType,
  created_at: new Date('2026-09-01T00:00:00Z'),
  created_by: 'xpand-import',
  deleted_at: null,
  deleted_by: null,
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
    const plan = reconcile([godMan, forvaltare], [], new Set())
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
      new Set()
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
      new Set()
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
    const plan = reconcile([changed], [row('a', godMan)], new Set())
    expect(plan).toEqual({
      toInsert: [changed],
      toDelete: ['a'],
      unchangedCount: 0,
      protectedCount: 0,
    })
  })

  it('never deletes fakturamottagare rows for a conflict holder', () => {
    const plan = reconcile([], [row('a', recipient)], new Set(['P5']))
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
    const plan = reconcile([], [row('a', guardianOfP5)], new Set(['P5']))
    expect(plan).toEqual({
      toInsert: [],
      toDelete: ['a'],
      unchangedCount: 0,
      protectedCount: 0,
    })
  })

  it('dedupes desired edges before inserting', () => {
    const plan = reconcile([godMan, godMan], [], new Set())
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
    const plan = reconcile([a, b], [], new Set())
    expect(plan.toInsert).toHaveLength(2)
  })

  it('counts duplicate existing rows for a desired key as unchanged', () => {
    const plan = reconcile(
      [godMan],
      [row('a', godMan), row('b', godMan)],
      new Set()
    )
    expect(plan).toEqual({
      toInsert: [],
      toDelete: [],
      unchangedCount: 2,
      protectedCount: 0,
    })
  })
})
