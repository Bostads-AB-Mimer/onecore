import { Knex } from 'knex'
import { type Resource } from '@onecore/utilities'
import z from 'zod'

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
import {
  AddRelationErrorCodeSchema,
  RemoveRelationErrorCodeSchema,
} from './schema'

export type AddRelationError = z.infer<typeof AddRelationErrorCodeSchema>
export type RemoveRelationError = z.infer<typeof RemoveRelationErrorCodeSchema>

/**
 * What the relation rules need from the outside world. Getters rather than
 * handles: Resources must be resolved per request, never captured.
 */
export type RelationDependencies = {
  db: () => Knex
  contactExists: (contactCode: string) => Promise<boolean>
  relatedContactsFor: (contactCode: string) => Promise<RelatedContact[]>
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
 */
const addRelation = async (
  deps: RelationDependencies,
  request: AddRelationRequest
): Promise<AdapterResult<void, AddRelationError>> => {
  const subject = request.subjectContactCode.trim()
  const related = request.relatedContactCode.trim()
  if (subject === related) return { ok: false, err: 'self-relation' }

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
  if (sameRole.some((r) => r.related_contact_code.trim() === related)) {
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
    await insertMany(
      db,
      [
        {
          subjectContactCode: subject,
          relatedContactCode: related,
          roleType: request.roleType,
        },
      ],
      request.createdBy
    )
  } catch (err) {
    const violated = violatedIndex(err)
    if (violated === 'guardian') return { ok: false, err: 'guardian-exists' }
    if (violated === 'edge') return { ok: false, err: 'duplicate-relation' }
    throw err
  }

  return { ok: true, data: undefined }
}

/**
 * Soft-deletes every active row matching the triple. History is kept: rows
 * get deleted_at/deleted_by and stay in the table.
 */
const removeRelation = async (
  deps: RelationDependencies,
  request: RemoveRelationRequest
): Promise<AdapterResult<void, RemoveRelationError>> => {
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
    .filter((r) => r.related_contact_code.trim() === related)
    .map((r) => r.id)
  if (ids.length === 0) return { ok: false, err: 'relation-not-found' }

  await softDeleteByIds(db, ids, request.deletedBy)
  return { ok: true, data: undefined }
}

/** Production wiring: Xpand for existence and names, contacts DB for edges. */
const makeRelationDependencies = (
  xpandDb: Resource<Knex>,
  contactsDb: Resource<Knex>
): RelationDependencies => ({
  db: () => contactsDb.get(),
  contactExists: (contactCode) => contactExists(xpandDb.get(), contactCode),
  relatedContactsFor: (contactCode) =>
    relatedContactsFor(xpandDb.get(), contactsDb.get(), contactCode),
})

export { addRelation, removeRelation, makeRelationDependencies }
