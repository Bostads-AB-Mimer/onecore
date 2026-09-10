import { Knex } from 'knex'
import { logger, type Resource } from '@onecore/utilities'

import { AdapterResult } from '@src/adapters/types'
import {
  activeRelationsInRole,
  insertMany,
  softDeleteByIds,
  RoleType,
} from '@src/adapters/contact-relations'
import { contactExists } from '@src/adapters/xpand/contact-lookup-query'
import { relatedContactsFor } from '@src/adapters/related-contacts'
import { RelatedContact } from '@src/domain/contact'
import { AddRelationErrorCode, RemoveRelationErrorCode } from './api-types'

/**
 * What the relation rules need from the outside world. Getters rather than
 * handles: Resources must be resolved per request, never captured.
 *
 * `relatedContactsFor` takes the handle to read through so the caller can pass
 * the write transaction and see its own uncommitted insert.
 */
export type RelationDependencies = {
  db: () => Knex
  contactExists: (contactCode: string) => Promise<boolean>
  relatedContactsFor: (
    contactCode: string,
    db: Knex
  ) => Promise<RelatedContact[]>
}

export type AddRelationRequest = {
  subjectContactCode: string
  relatedContactCode: string
  roleType: RoleType
  createdBy: string
}

export type RemoveRelationRequest = {
  subjectContactCode: string
  relatedContactCode: string
  roleType: RoleType
  deletedBy: string
}

/** A contact has at most one active guardian, of either type. */
const GUARDIAN_ROLES: RoleType[] = ['god_man', 'forvaltare']

// MSSQL error number for a unique-index violation. The message names the
// index, which tells us which rule the lost race broke.
const UNIQUE_VIOLATION = 2601

/**
 * Xpand looks contact codes up under a case-insensitive collation and so do
 * the unique indexes, so `P000111` and `p000111` are one contact everywhere
 * that matters. Comparing them case-sensitively here would let a self-edge
 * through and let a duplicate reach the index as a lost race.
 */
const sameContact = (a: string, b: string): boolean =>
  a.trim().toUpperCase() === b.trim().toUpperCase()

// A single 2601 message names exactly one violated index, so the check
// order below is immaterial.
const violatedIndex = (err: unknown): 'guardian' | 'edge' | null => {
  const e = err as { number?: number; message?: string }
  if (e?.number !== UNIQUE_VIOLATION) return null
  if (e.message?.includes('ux_contact_relation_active_guardian'))
    return 'guardian'
  if (e.message?.includes('ux_contact_relation_active_edge')) return 'edge'
  return null
}

/**
 * Adds an active relation after checking, in order: self-edge, both contacts
 * exist in Xpand, the exact edge is not already active, and (for guardian
 * roles) the subject has no active guardian of either type. The unique
 * indexes are the backstop for a race between two requests.
 *
 * The insert and the read-back of the subject's relations share one
 * transaction, so a failure reading back rolls the insert away rather than
 * reporting an error for a relation that was in fact written.
 */
const addRelation = async (
  deps: RelationDependencies,
  request: AddRelationRequest
): Promise<AdapterResult<RelatedContact[], AddRelationErrorCode>> => {
  const subject = request.subjectContactCode.trim()
  const related = request.relatedContactCode.trim()
  if (sameContact(subject, related)) return { ok: false, err: 'self-relation' }

  const [subjectExists, relatedExists] = await Promise.all([
    deps.contactExists(subject),
    deps.contactExists(related),
  ])
  if (!subjectExists) return { ok: false, err: 'subject-not-found' }
  if (!relatedExists) return { ok: false, err: 'related-not-found' }

  const db = deps.db()

  const sameRole = await activeRelationsInRole(
    db,
    subject,
    request.roleType,
    'subject'
  )
  if (sameRole.some((r) => sameContact(r.related_contact_code, related))) {
    return { ok: false, err: 'duplicate-relation' }
  }

  if (GUARDIAN_ROLES.includes(request.roleType)) {
    for (const role of GUARDIAN_ROLES) {
      const [existing] =
        role === request.roleType
          ? sameRole
          : await activeRelationsInRole(db, subject, role, 'subject')
      if (existing) {
        return {
          ok: false,
          err: 'guardian-exists',
          detail: existing.related_contact_code.trim(),
        }
      }
    }
  }

  try {
    const relations = await db.transaction(async (trx) => {
      await insertMany(
        trx,
        [
          {
            subjectContactCode: subject,
            relatedContactCode: related,
            roleType: request.roleType,
          },
        ],
        request.createdBy
      )
      return deps.relatedContactsFor(subject, trx)
    })
    return { ok: true, data: relations }
  } catch (err) {
    const violated = violatedIndex(err)
    if (violated !== null) {
      logger.warn(
        { subject, related, roleType: request.roleType, violated },
        'addRelation.lostRace'
      )
    }
    // No `detail` on the race path: unlike the pre-check branches above,
    // the winning row is never read back, so we have nothing to name.
    if (violated === 'guardian') return { ok: false, err: 'guardian-exists' }
    if (violated === 'edge') return { ok: false, err: 'duplicate-relation' }
    throw err
  }
}

/**
 * Soft-deletes every active row matching the triple. History is kept: rows
 * get deleted_at/deleted_by and stay in the table.
 *
 * The update, not the read before it, decides the answer: two concurrent
 * deletes both see the row, and the one whose update touches nothing has to
 * report `relation-not-found` rather than a second success.
 */
const removeRelation = async (
  deps: RelationDependencies,
  request: RemoveRelationRequest
): Promise<AdapterResult<void, RemoveRelationErrorCode>> => {
  const subject = request.subjectContactCode.trim()
  const related = request.relatedContactCode.trim()
  const db = deps.db()

  const rows = await activeRelationsInRole(
    db,
    subject,
    request.roleType,
    'subject'
  )
  const ids = rows
    .filter((r) => sameContact(r.related_contact_code, related))
    .map((r) => r.id)
  if (ids.length === 0) return { ok: false, err: 'relation-not-found' }

  const deleted = await softDeleteByIds(db, ids, request.deletedBy)
  if (deleted === 0) return { ok: false, err: 'relation-not-found' }

  return { ok: true, data: undefined }
}

/** Production wiring: Xpand for existence and names, contacts DB for edges. */
const makeRelationDependencies = (
  xpandDb: Resource<Knex>,
  contactsDb: Resource<Knex>
): RelationDependencies => ({
  db: () => contactsDb.get(),
  contactExists: (contactCode) => contactExists(xpandDb.get(), contactCode),
  relatedContactsFor: (contactCode, db) =>
    relatedContactsFor(xpandDb.get(), db, contactCode),
})

export { addRelation, removeRelation, makeRelationDependencies }
