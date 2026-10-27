import { Knex } from 'knex'
import * as repository from '@src/adapters/contact-relations/repository'
import {
  addRelation,
  removeRelation,
  RelationDependencies,
} from '@src/services/contacts-service/relations'
import * as factory from '../../factories'

// addRelation reads the relations back inside its write transaction, so the
// double has to hand the callback a usable handle. Handing back `fakeDb`
// itself keeps the `insertMany(fakeDb, ...)` assertions readable.
const fakeDb = {
  transaction: <T>(cb: (trx: Knex) => Promise<T>) => cb(fakeDb as Knex),
} as unknown as Knex

const deps = (
  overrides: Partial<RelationDependencies> = {}
): RelationDependencies => ({
  db: () => fakeDb,
  canonicalContactCode: jest.fn(async (code: string) => code),
  relatedContactForEdge: jest.fn().mockResolvedValue(null),
  relatedContactsFor: jest.fn().mockResolvedValue([]),
  ...overrides,
})

const add = {
  subjectContactCode: 'P000111',
  relatedContactCode: 'P000222',
  roleType: 'god_man' as const,
  createdBy: 'handläggare',
}

const uniqueViolation = (index: string) =>
  Object.assign(new Error(`Cannot insert duplicate key row ... '${index}'`), {
    number: 2601,
  })

describe('addRelation', () => {
  let inRole: jest.SpyInstance
  let insert: jest.SpyInstance

  beforeEach(() => {
    inRole = jest
      .spyOn(repository, 'activeRelationsInRole')
      .mockResolvedValue([])
    insert = jest.spyOn(repository, 'insertMany').mockResolvedValue(undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  it('inserts the edge attributed to createdBy', async () => {
    const result = await addRelation(deps(), add)

    expect(result).toEqual({ ok: true, data: [] })
    expect(insert).toHaveBeenCalledWith(
      fakeDb,
      [
        {
          subjectContactCode: 'P000111',
          relatedContactCode: 'P000222',
          roleType: 'god_man',
        },
      ],
      'handläggare'
    )
  })

  it('trims codes before checking and inserting', async () => {
    await addRelation(deps(), { ...add, relatedContactCode: ' P000222 ' })
    expect(insert.mock.calls[0][1][0].relatedContactCode).toBe('P000222')
  })

  it('rejects a self-relation before touching anything', async () => {
    const d = deps()
    const result = await addRelation(d, {
      ...add,
      relatedContactCode: 'P000111',
    })
    expect(result).toEqual({ ok: false, err: 'self-relation' })
    expect(d.canonicalContactCode).not.toHaveBeenCalled()
  })

  it('rejects when the subject does not exist in Xpand', async () => {
    const d = deps({
      canonicalContactCode: jest.fn(async (code: string) =>
        code === 'P000111' ? null : code
      ),
    })
    expect(await addRelation(d, add)).toEqual({
      ok: false,
      err: 'subject-not-found',
    })
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects when the related contact does not exist in Xpand', async () => {
    const d = deps({
      canonicalContactCode: jest.fn(async (code: string) =>
        code === 'P000222' ? null : code
      ),
    })
    expect(await addRelation(d, add)).toEqual({
      ok: false,
      err: 'related-not-found',
    })
  })

  it('rejects a duplicate active edge', async () => {
    inRole.mockResolvedValue([
      factory.dbContactRelationRow.build({
        subject_contact_code: 'P000111',
        related_contact_code: 'P000222',
        role_type: 'god_man',
      }),
    ])
    expect(await addRelation(deps(), add)).toEqual({
      ok: false,
      err: 'duplicate-relation',
    })
  })

  it('rejects a different guardian in the same role, naming the existing one', async () => {
    inRole.mockResolvedValue([
      factory.dbContactRelationRow.build({
        subject_contact_code: 'P000111',
        related_contact_code: 'P000444',
        role_type: 'god_man',
      }),
    ])
    expect(await addRelation(deps(), add)).toEqual({
      ok: false,
      err: 'guardian-exists',
      detail: 'P000444',
    })
  })

  it('rejects a second guardian of the other type, naming the existing one', async () => {
    inRole.mockImplementation(async (_db, _code, roleType) =>
      roleType === 'forvaltare'
        ? [
            factory.dbContactRelationRow.build({
              subject_contact_code: 'P000111',
              related_contact_code: 'P000999',
              role_type: 'forvaltare',
            }),
          ]
        : []
    )
    expect(await addRelation(deps(), add)).toEqual({
      ok: false,
      err: 'guardian-exists',
      detail: 'P000999',
    })
    expect(insert).not.toHaveBeenCalled()
  })

  it('does not apply the guardian rule to annan_fakturamottagare', async () => {
    inRole.mockImplementation(async (_db, _code, roleType) =>
      roleType === 'god_man'
        ? [factory.dbContactRelationRow.build({ role_type: 'god_man' })]
        : []
    )
    const result = await addRelation(deps(), {
      ...add,
      roleType: 'annan_fakturamottagare',
    })
    expect(result).toEqual({ ok: true, data: [] })
  })

  // Xpand matches contact codes case-insensitively, so a subject and related
  // code differing only in case are the same contact. Letting the pair through
  // writes a self-edge the read path cannot render but the guardian index
  // still counts, leaving the subject unable to get a guardian at all.
  it('rejects a self-relation that differs only in case', async () => {
    const result = await addRelation(deps(), {
      ...add,
      relatedContactCode: 'p000111',
    })

    expect(result).toEqual({ ok: false, err: 'self-relation' })
    expect(insert).not.toHaveBeenCalled()
  })

  // Xpand answers a lowercase lookup, but the read path keys names by the code
  // Xpand returns, so a row stored in the caller's casing is dropped from both
  // kundkort while still occupying the subject's guardian slot.
  it('persists the codes as Xpand spells them, not as the caller sent them', async () => {
    const canonicalContactCode = jest.fn(async (code: string) =>
      code.toUpperCase()
    )

    await addRelation(deps({ canonicalContactCode }), {
      ...add,
      subjectContactCode: 'p000111',
      relatedContactCode: 'p000222',
    })

    expect(insert.mock.calls[0][1][0]).toEqual({
      subjectContactCode: 'P000111',
      relatedContactCode: 'P000222',
      roleType: 'god_man',
    })
  })

  // Holding the contacts-DB write open across an Xpand round-trip would keep
  // row locks and a pooled connection for the length of an unrelated system's
  // latency, so both reads happen before the insert.
  it('reads the relations before inserting, not inside the write', async () => {
    const order: string[] = []
    const relatedContactsFor = jest.fn(async () => {
      order.push('read')
      return []
    })
    const relatedContactForEdge = jest.fn(async () => {
      order.push('read-added')
      return null
    })
    insert.mockImplementation(async () => {
      order.push('insert')
    })

    await addRelation(deps({ relatedContactsFor, relatedContactForEdge }), add)

    expect(order).toEqual(['read', 'read-added', 'insert'])
  })

  it('answers with the existing relations plus the one just added', async () => {
    const existing = factory.relatedContact.build({
      contactCode: 'P000999',
      role: 'otherInvoiceRecipient',
    })
    const added = factory.relatedContact.build({
      contactCode: 'P000222',
      role: 'trustee',
    })

    const result = await addRelation(
      deps({
        relatedContactsFor: jest.fn().mockResolvedValue([existing]),
        relatedContactForEdge: jest.fn().mockResolvedValue(added),
      }),
      add
    )

    expect(result).toEqual({ ok: true, data: [existing, added] })
  })

  it('omits the new relation when its counterpart is gone from Xpand', async () => {
    const result = await addRelation(deps(), add)

    expect(result).toEqual({ ok: true, data: [] })
  })

  // The reads come first, so a failure leaves nothing written at all.
  it('writes nothing when the relations cannot be read', async () => {
    const relatedContactsFor = jest
      .fn()
      .mockRejectedValue(new Error('xpand unavailable'))

    await expect(
      addRelation(deps({ relatedContactsFor }), add)
    ).rejects.toThrow('xpand unavailable')
    expect(insert).not.toHaveBeenCalled()
  })

  it('maps a lost race on the guardian index to guardian-exists', async () => {
    insert.mockRejectedValue(
      uniqueViolation('ux_contact_relation_active_guardian')
    )
    expect(await addRelation(deps(), add)).toEqual({
      ok: false,
      err: 'guardian-exists',
    })
  })

  it('maps a lost race on the edge index to duplicate-relation', async () => {
    insert.mockRejectedValue(uniqueViolation('ux_contact_relation_active_edge'))
    expect(await addRelation(deps(), add)).toEqual({
      ok: false,
      err: 'duplicate-relation',
    })
  })

  // A racing insert of an identical guardian edge breaks both indexes at once,
  // and SQL Server decides which it names. The exact edge already exists, so
  // that is what the caseworker is told either way.
  it('reports a duplicate when the violation names both indexes', async () => {
    insert.mockRejectedValue(
      uniqueViolation(
        'ux_contact_relation_active_guardian ... ux_contact_relation_active_edge'
      )
    )

    expect(await addRelation(deps(), add)).toEqual({
      ok: false,
      err: 'duplicate-relation',
    })
  })

  it('rethrows any other database error', async () => {
    insert.mockRejectedValue(new Error('boom'))
    await expect(addRelation(deps(), add)).rejects.toThrow('boom')
  })
})

describe('removeRelation', () => {
  let inRole: jest.SpyInstance
  let softDelete: jest.SpyInstance

  beforeEach(() => {
    inRole = jest
      .spyOn(repository, 'activeRelationsInRole')
      .mockResolvedValue([])
    softDelete = jest.spyOn(repository, 'softDeleteByIds').mockResolvedValue(1)
  })
  afterEach(() => jest.restoreAllMocks())

  const remove = {
    subjectContactCode: 'P000111',
    relatedContactCode: 'P000222',
    roleType: 'god_man' as const,
    deletedBy: 'handläggare',
  }

  it('soft-deletes every active row for the triple, attributed to deletedBy', async () => {
    inRole.mockResolvedValue([
      factory.dbContactRelationRow.build({
        id: 'a',
        related_contact_code: 'P000222',
      }),
      factory.dbContactRelationRow.build({
        id: 'b',
        related_contact_code: 'P000222 ',
      }),
      factory.dbContactRelationRow.build({
        id: 'c',
        related_contact_code: 'P000333',
      }),
    ])

    const result = await removeRelation(deps(), remove)

    expect(result).toEqual({ ok: true, data: undefined })
    expect(softDelete).toHaveBeenCalledWith(fakeDb, ['a', 'b'], 'handläggare')
  })

  // Two concurrent deletes both read the row; only one update touches it.
  it('returns relation-not-found when a concurrent delete got there first', async () => {
    inRole.mockResolvedValue([
      factory.dbContactRelationRow.build({
        id: 'a',
        related_contact_code: 'P000222',
      }),
    ])
    softDelete.mockResolvedValue(0)

    expect(await removeRelation(deps(), remove)).toEqual({
      ok: false,
      err: 'relation-not-found',
    })
  })

  it('returns relation-not-found when nothing matches', async () => {
    expect(await removeRelation(deps(), remove)).toEqual({
      ok: false,
      err: 'relation-not-found',
    })
    expect(softDelete).not.toHaveBeenCalled()
  })
})
