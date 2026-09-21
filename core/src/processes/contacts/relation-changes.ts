import { logger } from '@onecore/utilities'
import type {
  GetRelatedContactsResponseBody,
  RelatedContactRole,
  RelationRoleType,
} from '@onecore/contacts/schema'

import config from '../../common/config'
import { ProcessError, ProcessStatus, ProcessSuccess } from '../../common/types'
import {
  contactsAdapter,
  type AddRelationError,
  type RelationRef,
  type RemoveRelationError,
} from '../../adapters/contacts-adapter'
import { syncContactToLeasing } from '../../adapters/leasing-adapter'
import { sendEmail } from '../../adapters/communication-adapter'
import { syncInvoiceRecipientToEconomy } from './sync-invoice-recipient'

type Relations = GetRelatedContactsResponseBody['content']

// No Odoo step: nothing in the work-order service consumes relations.

/**
 * Everything a relation write can answer with. Two are this process's own:
 * `propagation-failed` (a downstream system could not be told, so the change
 * was undone) and `rollback-failed` (undoing it failed too, so the change
 * stands unpropagated). They stay separate because they call for opposite
 * things from the caseworker: retry the first, never the second.
 */
export type RelationChangeError =
  | AddRelationError
  | RemoveRelationError
  | 'propagation-failed'
  | 'rollback-failed'

/**
 * Relation-write statuses pass through so the caller can tell apart cases that
 * share a code. `contacts-service-error` is the adapter's unnamed-failure
 * catch-all, so it is 502 whatever status carried it: forwarding the 404 of an
 * unrouted path would report an outage as a client error.
 */
export const addRelationStatus = (
  err: AddRelationError,
  statusCode?: number
): 400 | 404 | 409 | 422 | 502 =>
  err !== 'contacts-service-error' &&
  (statusCode === 400 ||
    statusCode === 404 ||
    statusCode === 409 ||
    statusCode === 422)
    ? statusCode
    : 502

export const removeRelationStatus = (
  err: RemoveRelationError,
  statusCode?: number
): 400 | 404 | 502 =>
  err !== 'contacts-service-error' && (statusCode === 400 || statusCode === 404)
    ? statusCode
    : 502

/**
 * Failure shapes narrowed to each direction's actual `httpStatus` set, rather
 * than the `number` `ProcessError` declares: a status outside the route's
 * declared response codes then fails to compile instead of silently violating
 * the contract.
 */
type AddRelationFailure = ProcessError<RelationChangeError> & {
  httpStatus: ReturnType<typeof addRelationStatus>
}
type RemoveRelationFailure = ProcessError<RelationChangeError> & {
  httpStatus: ReturnType<typeof removeRelationStatus>
}

type AddRelationResult = ProcessSuccess<Relations> | AddRelationFailure
type RemoveRelationResult = ProcessSuccess<void> | RemoveRelationFailure

const propagationFailed = (
  detail: 'economy' | 'tenfast'
): ProcessError<RelationChangeError> & { httpStatus: 502 } => ({
  processStatus: ProcessStatus.failed,
  error: 'propagation-failed',
  httpStatus: 502,
  response: { detail },
})

const rollbackFailed = (): ProcessError<RelationChangeError> & {
  httpStatus: 502
} => ({
  processStatus: ProcessStatus.failed,
  error: 'rollback-failed',
  httpStatus: 502,
  response: { detail: 'tenfast' },
})

/**
 * The forward relation role a role type appears as on the subject's contact.
 * The `…For` roles are deliberately absent — they are the same edge seen from
 * the other end, and matching one would read the relation off the wrong side.
 */
const FORWARD_ROLE_FOR_ROLE_TYPE: Record<RelationRoleType, RelatedContactRole> =
  {
    god_man: 'trustee',
    forvaltare: 'administrator',
    annan_fakturamottagare: 'otherInvoiceRecipient',
  }

/**
 * Whether the relation exists, read *before* the write. Afterwards a lost
 * response is indistinguishable from a rejected one, and only the prior state
 * says which — compensating on the wrong guess is data loss.
 *
 * Not a lock: another caseworker can still change the relation between this
 * read and the write. Closing that window would need a conditional write API
 * in the contacts service, which this deliberately does not reach for.
 */
type RelationPresence = 'present' | 'absent' | 'unknown'

const readRelationPresence = async (
  params: RelationRef
): Promise<RelationPresence> => {
  const result = await contactsAdapter.getByContactCodeBatch(
    [params.contactCode],
    { includeRelations: true }
  )

  if (!result.ok) {
    logger.warn(
      { contactCode: params.contactCode, err: result.err },
      'relationChanges.presenceReadFailed'
    )
    return 'unknown'
  }

  // The batch endpoint omits contact codes it does not know, so a missing
  // contact means there is no relation to speak of.
  const relations =
    result.data.find((c) => c.contactCode === params.contactCode)
      ?.relatedContacts ?? []

  const role = FORWARD_ROLE_FOR_ROLE_TYPE[params.roleType]
  return relations.some(
    (r) => r.role === role && r.contactCode === params.relatedContactCode
  )
    ? 'present'
    : 'absent'
}

/**
 * The Xledger customer is upserted before the relation is written, so a write
 * that never lands leaves one behind. Customers are never deleted, so this
 * log is the only record that one exists without a purpose.
 */
const logOrphanedXledgerCustomer = (
  params: RelationRef,
  reason: string
): void => {
  if (params.roleType !== 'annan_fakturamottagare') return

  logger.warn(
    {
      contactCode: params.contactCode,
      relatedContactCode: params.relatedContactCode,
      reason,
    },
    'relationChanges.xledgerCustomerOrphaned'
  )
}

/**
 * The audit-trail actor recorded on a compensating write. Contacts bounds the
 * actor to NVARCHAR(100), so the *name* is sliced rather than the annotated
 * string — a dropped ` (rollback)` suffix would leave the audit row
 * indistinguishable from a normal write.
 */
const rollbackActor = (actor: string): string =>
  `${actor.slice(0, 89)} (rollback)`

/**
 * Every direction-dependent phrase the alarm prose needs, so the branches
 * shared between add and remove cannot fall back to add-shaped text. Getting
 * one wrong sends whoever reads the alarm to perform the opposite repair.
 */
const relationActionWords = (
  action: 'add' | 'remove'
): {
  done: string
  undone: string
  unknownOutcome: string
  compensation: string
  staleRisk: string
} =>
  action === 'add'
    ? {
        done: 'lades till',
        undone: 'togs bort igen',
        unknownOutcome: 'skapades',
        compensation: 'ta bort den',
        staleRisk: 'Tenfast kan fortfarande visa den nya relationen.',
      }
    : {
        done: 'togs bort',
        undone: 'lades till igen',
        unknownOutcome: 'togs bort',
        compensation: 'lägga tillbaka den',
        staleRisk: 'Tenfast kan fortfarande sakna relationen.',
      }

/**
 * Raised when the contacts database may now disagree with Tenfast — the exact
 * state this process exists to prevent — and nothing retries it, so a human
 * has to repair it.
 *
 * Never awaited (a hung mail send must not hold a caseworker's request open),
 * and never rejects: only the send can throw, and it is guarded.
 */
const alarmRollbackFailed = async (params: {
  action: 'add' | 'remove'
  relation: RelationRef
  actor: string
  /** Only the add path upserts a customer, so only it can strand one. */
  xledgerCustomerTouched: boolean
  outcome:
    | {
        kind: 'rollback-failed'
        propagationError: string
        rollbackError: string
      }
    | {
        kind: 'resync-unconfirmed'
        propagationError: string
        resyncError: string
      }
    /** No `rollbackError` when no compensating write was attempted at all. */
    | { kind: 'write-outcome-unknown'; rollbackError?: string }
}): Promise<void> => {
  logger.error(params, 'relationChanges.rollbackFailed')

  if (!config.emailAddresses.xpandSync) {
    logger.warn(
      'config.emailAddresses.xpandSync is not set — skipping rollback alarm'
    )
    return
  }

  const { done, undone, unknownOutcome, compensation, staleRisk } =
    relationActionWords(params.action)
  const { relation, actor, outcome, xledgerCustomerTouched } = params
  const propagationHeader = (propagationError: string): string =>
    `Relationen ${relation.roleType} mellan ${relation.contactCode} och ${relation.relatedContactCode} ${done} av ${actor} men kunde inte propageras till Tenfast (${propagationError}).`

  let body: string[]
  switch (outcome.kind) {
    case 'rollback-failed':
      body = [
        propagationHeader(outcome.propagationError),
        `Återställningen (${undone}) misslyckades också: ${outcome.rollbackError}.`,
        '',
        'Kontaktdatabasen har därmed en ändring som Tenfast aldrig fått veta om. Kontrollera och rätta manuellt.',
      ]
      break
    case 'resync-unconfirmed':
      body = [
        propagationHeader(outcome.propagationError),
        `Relationen ${undone} i kontaktdatabasen, men detta kunde inte bekräftas mot Tenfast: ${outcome.resyncError}.`,
        '',
        `${staleRisk} Kontrollera och rätta manuellt.`,
      ]
      break
    case 'write-outcome-unknown':
      body = [
        `Skrivningen av relationen ${relation.roleType} mellan ${relation.contactCode} och ${relation.relatedContactCode} (${done} av ${actor}) fick inget svar från kontakttjänsten, så det är okänt om relationen ${unknownOutcome}.`,
        outcome.rollbackError
          ? `Ett försök att ${compensation} gjordes som säkerhetsåtgärd men misslyckades: ${outcome.rollbackError}.`
          : 'Relationens tidigare tillstånd kunde inte läsas, så ingen automatisk återställning gjordes.',
        '',
        'Relationen måste kontrolleras manuellt.',
      ]
      break
  }

  if (
    relation.roleType === 'annan_fakturamottagare' &&
    xledgerCustomerTouched
  ) {
    body.push(
      '',
      `Obs: en kund kan ha skapats i Xledger för ${relation.relatedContactCode} och står nu utan syfte.`
    )
  }

  try {
    const sent = await sendEmail({
      to: config.emailAddresses.xpandSync,
      subject: `relationer: ${relation.contactCode} kräver manuell kontroll`,
      body: body.join('\n'),
    })
    if (!sent.ok) {
      logger.error({ err: sent.err }, 'relationChanges.rollbackAlarmMailFailed')
    }
  } catch (emailErr) {
    logger.error({ emailErr }, 'relationChanges.rollbackAlarmMailFailed')
  }
}

/**
 * Reports a confirming resync that failed after a successful compensating
 * write, alarming only when Tenfast can actually be out of step.
 *
 * Tenfast pulls our contact, so it can only hold the reverted change if the
 * original push reached it. `sync-failed` means leasing answered and the push
 * did not go through, so there is nothing to repair — and that is the branch
 * every edit takes during an outage, which would bury the genuine alarms.
 */
const notifyResyncUnconfirmed = (params: {
  action: 'add' | 'remove'
  relation: RelationRef
  actor: string
  xledgerCustomerTouched: boolean
  propagationError: string
  propagationWasAmbiguous: boolean
  resyncError: string
}): void => {
  const { propagationWasAmbiguous, propagationError, resyncError, ...rest } =
    params

  if (!propagationWasAmbiguous) {
    logger.warn(
      { ...rest, propagationError, resyncError },
      'relationChanges.rollbackResyncFailed'
    )
    return
  }

  void alarmRollbackFailed({
    ...rest,
    outcome: { kind: 'resync-unconfirmed', propagationError, resyncError },
  })
}

/**
 * Adds a relation and propagates it, undoing the write if propagation fails.
 *
 * Xledger runs first because an unused customer record is harmless, so a
 * failure there leaves nothing to undo. The Tenfast resync has to run last:
 * Tenfast pulls our contact, so an earlier trigger would read the old state.
 */
export const addRelationWithPropagation = async (
  params: RelationRef & { createdBy: string }
): Promise<AddRelationResult> => {
  switch (params.roleType) {
    case 'annan_fakturamottagare': {
      const economy = await syncInvoiceRecipientToEconomy(
        contactsAdapter,
        params.relatedContactCode
      )
      if (!economy.ok) {
        // Answer the way the relation write would have, or the caseworker
        // gets an outage error for their own typo.
        if (economy.err === 'contact-not-found') {
          return {
            processStatus: ProcessStatus.failed,
            error: 'related-not-found',
            httpStatus: 404,
          }
        }
        logger.error(
          {
            contactCode: params.contactCode,
            relatedContactCode: params.relatedContactCode,
            roleType: params.roleType,
            actor: params.createdBy,
            stage: 'economy',
            err: economy.err,
          },
          'relationChanges.propagationFailed'
        )
        return propagationFailed('economy')
      }
      break
    }
    case 'god_man':
    case 'forvaltare':
      break
    default: {
      // Exhaustiveness check: a new role fails to compile rather than
      // silently skipping the Xledger step.
      const unhandled: never = params.roleType
      throw new Error(`Unhandled relation role type: ${unhandled}`)
    }
  }

  const presenceBefore = await readRelationPresence(params)

  const added = await contactsAdapter.addRelation(params)
  if (!added.ok) {
    if (
      added.err === 'contacts-service-error' &&
      added.statusCode === undefined
    ) {
      // No status code means the response was lost, not that the write was
      // rejected. With the relation already present the service can only
      // have refused it as a duplicate, so there is nothing to undo and
      // removing it would delete a relation nobody asked to lose.
      if (presenceBefore === 'absent') {
        const compensated = await contactsAdapter.removeRelation({
          contactCode: params.contactCode,
          relatedContactCode: params.relatedContactCode,
          roleType: params.roleType,
          deletedBy: rollbackActor(params.createdBy),
        })
        if (!compensated.ok && compensated.err !== 'relation-not-found') {
          void alarmRollbackFailed({
            action: 'add',
            relation: params,
            actor: params.createdBy,
            xledgerCustomerTouched:
              params.roleType === 'annan_fakturamottagare',
            outcome: {
              kind: 'write-outcome-unknown',
              rollbackError: compensated.err,
            },
          })
        }
      } else if (presenceBefore === 'unknown') {
        void alarmRollbackFailed({
          action: 'add',
          relation: params,
          actor: params.createdBy,
          xledgerCustomerTouched: params.roleType === 'annan_fakturamottagare',
          outcome: { kind: 'write-outcome-unknown' },
        })
      }
    }

    // Not when the relation was already there: that customer is in use.
    if (presenceBefore !== 'present') {
      logOrphanedXledgerCustomer(params, added.err)
    }

    return {
      processStatus: ProcessStatus.failed,
      error: added.err,
      httpStatus: addRelationStatus(added.err, added.statusCode),
      response: { detail: added.detail },
    }
  }

  const synced = await syncContactToLeasing(params.contactCode)
  if (!synced.ok) {
    const rolledBack = await contactsAdapter.removeRelation({
      contactCode: params.contactCode,
      relatedContactCode: params.relatedContactCode,
      roleType: params.roleType,
      deletedBy: rollbackActor(params.createdBy),
    })

    logger.error(
      {
        contactCode: params.contactCode,
        relatedContactCode: params.relatedContactCode,
        roleType: params.roleType,
        actor: params.createdBy,
        stage: 'tenfast',
        err: synced.err,
      },
      'relationChanges.propagationFailed'
    )

    // `relation-not-found` is the state the rollback was aiming for — someone
    // else got there first. Idempotent, not a failure.
    if (!rolledBack.ok && rolledBack.err !== 'relation-not-found') {
      void alarmRollbackFailed({
        action: 'add',
        relation: params,
        actor: params.createdBy,
        xledgerCustomerTouched: params.roleType === 'annan_fakturamottagare',
        outcome: {
          kind: 'rollback-failed',
          propagationError: synced.err,
          rollbackError: rolledBack.err,
        },
      })
      return rollbackFailed()
    }

    logOrphanedXledgerCustomer(params, 'propagation-failed')

    // Tenfast pulls our contact, so if the original push landed before we
    // lost the response it may already hold the relation we just removed.
    const resynced = await syncContactToLeasing(params.contactCode)
    if (!resynced.ok) {
      notifyResyncUnconfirmed({
        action: 'add',
        relation: params,
        actor: params.createdBy,
        xledgerCustomerTouched: params.roleType === 'annan_fakturamottagare',
        propagationError: synced.err,
        propagationWasAmbiguous: synced.err === 'unknown',
        resyncError: resynced.err,
      })
    }

    return propagationFailed('tenfast')
  }

  return {
    processStatus: ProcessStatus.successful,
    data: added.data,
    httpStatus: 201,
  }
}

/**
 * Removes a relation and propagates it, putting the relation back if
 * propagation fails.
 *
 * No Xledger step: customers are never deleted, and the recipient may still
 * be invoiced under another lease or relation.
 */
export const removeRelationWithPropagation = async (
  params: RelationRef & { deletedBy: string }
): Promise<RemoveRelationResult> => {
  const presenceBefore = await readRelationPresence(params)

  const removed = await contactsAdapter.removeRelation(params)
  if (!removed.ok) {
    if (
      removed.err === 'contacts-service-error' &&
      removed.statusCode === undefined
    ) {
      // See the add direction. With no relation there to begin with, the
      // lost response can only have been a `relation-not-found`: adding one
      // back would conjure a relation nobody ever asked for.
      if (presenceBefore === 'present') {
        const compensated = await contactsAdapter.addRelation({
          contactCode: params.contactCode,
          relatedContactCode: params.relatedContactCode,
          roleType: params.roleType,
          createdBy: rollbackActor(params.deletedBy),
        })
        if (!compensated.ok && compensated.err !== 'duplicate-relation') {
          void alarmRollbackFailed({
            action: 'remove',
            relation: params,
            actor: params.deletedBy,
            xledgerCustomerTouched: false,
            outcome: {
              kind: 'write-outcome-unknown',
              rollbackError: compensated.err,
            },
          })
        }
      } else if (presenceBefore === 'unknown') {
        void alarmRollbackFailed({
          action: 'remove',
          relation: params,
          actor: params.deletedBy,
          xledgerCustomerTouched: false,
          outcome: { kind: 'write-outcome-unknown' },
        })
      }
    }

    return {
      processStatus: ProcessStatus.failed,
      error: removed.err,
      httpStatus: removeRelationStatus(removed.err, removed.statusCode),
      response: { detail: removed.detail },
    }
  }

  const synced = await syncContactToLeasing(params.contactCode)
  if (!synced.ok) {
    const restored = await contactsAdapter.addRelation({
      contactCode: params.contactCode,
      relatedContactCode: params.relatedContactCode,
      roleType: params.roleType,
      createdBy: rollbackActor(params.deletedBy),
    })

    logger.error(
      {
        contactCode: params.contactCode,
        relatedContactCode: params.relatedContactCode,
        roleType: params.roleType,
        actor: params.deletedBy,
        stage: 'tenfast',
        err: synced.err,
      },
      'relationChanges.propagationFailed'
    )

    // `duplicate-relation` means the relation is back — the state the restore
    // was aiming for, whether this call or a concurrent one put it there.
    if (!restored.ok && restored.err !== 'duplicate-relation') {
      void alarmRollbackFailed({
        action: 'remove',
        relation: params,
        actor: params.deletedBy,
        xledgerCustomerTouched: false,
        outcome: {
          kind: 'rollback-failed',
          propagationError: synced.err,
          rollbackError: restored.err,
        },
      })
      return rollbackFailed()
    }

    // See the add direction: Tenfast may already have re-read the removal.
    const resynced = await syncContactToLeasing(params.contactCode)
    if (!resynced.ok) {
      notifyResyncUnconfirmed({
        action: 'remove',
        relation: params,
        actor: params.deletedBy,
        xledgerCustomerTouched: false,
        propagationError: synced.err,
        propagationWasAmbiguous: synced.err === 'unknown',
        resyncError: resynced.err,
      })
    }

    return propagationFailed('tenfast')
  }

  return {
    processStatus: ProcessStatus.successful,
    data: undefined,
    httpStatus: 204,
  }
}
