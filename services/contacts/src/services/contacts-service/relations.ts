import { Knex } from 'knex'
import { logger, type Resource } from '@onecore/utilities'

import { AdapterResult } from '@src/adapters/types'
import {
  activeRelationsInRole,
  insertMany,
  softDeleteByIds,
  RoleType,
} from '@src/adapters/contact-relations'
import { canonicalContactCode } from '@src/adapters/xpand/contact-lookup-query'
import { relatedContactsFor } from '@src/adapters/related-contacts'
import { RelatedContact } from '@src/domain/contact'
import { AddRelationErrorCode, RemoveRelationErrorCode } from './api-types'

/**
 * What the relation rules need from the outside world. Getters rather than
 * handles: Resources must be resolved per request, never captured.
 * `relatedContactsFor` takes its handle so the caller can pass the write
 * transaction and see its own uncommitted insert.
 */
export type RelationDependencies = {
  db: () => Knex
  canonicalContactCode: (contactCode: string) => Promise<string | null>
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

// Xpand and the unique indexes both collate case-insensitively, so P000111 and
// p000111 are one contact; comparing case-sensitively would let a self-edge in.
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
 * roles) the subject has no active guardian of either type. The unique indexes
 * are the backstop for a race between two requests.
 *
 * Insert and read-back share a transaction, so a failed read rolls the insert
 * away instead of reporting an error for a relation that was written.
 */
const addRelation = async (
  deps: RelationDependencies,
  request: AddRelationRequest
): Promise<AdapterResult<RelatedContact[], AddRelationErrorCode>> => {
  if (sameContact(request.subjectContactCode, request.relatedContactCode)) {
    return { ok: false, err: 'self-relation' }
  }

  // Everything below works in Xpand's spelling, not the caller's, so the row
  // written is the row the read path can find again.
  const [subject, related] = await Promise.all([
    deps.canonicalContactCode(request.subjectContactCode.trim()),
    deps.canonicalContactCode(request.relatedContactCode.trim()),
  ])
  if (subject === null) return { ok: false, err: 'subject-not-found' }
  if (related === null) return { ok: false, err: 'related-not-found' }

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
 * Soft-deletes every active row matching the triple; history is kept. The
 * update, not the read before it, decides the answer — two concurrent deletes
 * both see the row, and the one that touches nothing is `relation-not-found`.
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
  canonicalContactCode: (contactCode) =>
    canonicalContactCode(xpandDb.get(), contactCode),
  relatedContactsFor: (contactCode, db) =>
    relatedContactsFor(xpandDb.get(), db, contactCode),
})

export { addRelation, removeRelation, makeRelationDependencies }
