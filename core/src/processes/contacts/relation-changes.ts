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
import { AdapterResult } from '../../adapters/types'
import { sendEmail } from '../../adapters/communication-adapter'
import { syncInvoiceRecipientToEconomy } from './sync-invoice-recipient'

type Relations = GetRelatedContactsResponseBody['content']

// No Odoo step: nothing in the work-order service consumes relations.

/**
 * What this process can fail with that the write itself cannot: the relation
 * was acceptable, but a downstream system could not be told. They stay two
 * codes because they call for opposite things from the caseworker — retry
 * `propagation-failed` (the change was undone), never `rollback-failed`
 * (undoing it failed too, so the change stands).
 */
type PropagationError = 'propagation-failed' | 'rollback-failed'

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
type AddRelationFailure = ProcessError<AddRelationError | PropagationError> & {
  httpStatus: ReturnType<typeof addRelationStatus>
}
type RemoveRelationFailure = ProcessError<
  RemoveRelationError | PropagationError
> & {
  httpStatus: ReturnType<typeof removeRelationStatus>
}

type AddRelationResult = ProcessSuccess<Relations> | AddRelationFailure
type RemoveRelationResult = ProcessSuccess<void> | RemoveRelationFailure

const propagationFailed = (
  detail: 'economy' | 'tenfast'
): ProcessError<'propagation-failed'> & { httpStatus: 502 } => ({
  processStatus: ProcessStatus.failed,
  error: 'propagation-failed',
  httpStatus: 502,
  response: { detail },
})

const rollbackFailed = (): ProcessError<'rollback-failed'> & {
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
 * Which roles are synced to the economy service as a customer. Only the invoice recipient
 * is — a god man does not receive the invoice unless they are separately
 * registered as fakturamottagare.
 *
 * A Record over the role union rather than a check against the one role that
 * syncs: a role added upstream fails to compile here until someone answers
 * this question for it, instead of silently defaulting to "no customer".
 */
const SYNC_TO_ECONOMY: Record<RelationRoleType, boolean> = {
  god_man: false,
  forvaltare: false,
  annan_fakturamottagare: true,
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

/**
 * The service answers with Xpand's spelling of a code but accepts other
 * casing and padding on input, so an exact match would read a live relation
 * as absent.
 */
const sameContactCode = (a: string, b: string): boolean =>
  a.trim().toUpperCase() === b.trim().toUpperCase()

const readRelationPresence = async (
  params: RelationRef
): Promise<RelationPresence> => {
  // The contacts adapter does not catch request exceptions on reads, so a
  // network failure or the adapter's own timeout rejects rather than
  // returning a result. Letting it escape would answer the caseworker with an
  // unstructured 500 and skip the write entirely.
  const result = await contactsAdapter
    .getByContactCodeBatch([params.contactCode], { includeRelations: true })
    .catch((err): AdapterResult<never, 'unknown'> => {
      logger.warn(
        { contactCode: params.contactCode, err },
        'relationChanges.presenceReadThrew'
      )
      return { ok: false, err: 'unknown' }
    })

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
    result.data.find((c) => sameContactCode(c.contactCode, params.contactCode))
      ?.relatedContacts ?? []

  const role = FORWARD_ROLE_FOR_ROLE_TYPE[params.roleType]
  return relations.some(
    (r) =>
      r.role === role &&
      sameContactCode(r.contactCode, params.relatedContactCode)
  )
    ? 'present'
    : 'absent'
}

/**
 * The economy-service customer is upserted before the relation is written, so a write
 * that never lands leaves one behind. Customers are never deleted, so this
 * log is the only record that one exists without a purpose.
 */
const logOrphanedEconomyCustomer = (
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
    'relationChanges.economyCustomerOrphaned'
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
  economyCustomerTouched: boolean
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
  const { relation, actor, outcome, economyCustomerTouched } = params
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
    economyCustomerTouched
  ) {
    body.push(
      '',
      `Obs: en kund kan ha skapats i ekonomisystemet för ${relation.relatedContactCode} och står nu utan syfte.`
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
 * Creates the related contact as a customer in the economy service, for the
 * roles that need one there. Reports success for the roles that do not.
 *
 * The only role-dependent step in either direction — the Tenfast resync runs
 * for every relation.
 */
const syncRelatedContactToEconomy = async (
  params: RelationRef & { createdBy: string }
): Promise<AdapterResult<null, 'contact-not-found' | 'sync-failed'>> => {
  if (!SYNC_TO_ECONOMY[params.roleType]) return { ok: true, data: null }

  const economy = await syncInvoiceRecipientToEconomy(
    contactsAdapter,
    params.relatedContactCode
  )

  if (!economy.ok) {
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
  }

  return economy
}

/**
 * Adds a relation and propagates it, undoing the write if propagation fails.
 *
 * The economy sync runs first because an unused customer record is harmless, so a
 * failure there leaves nothing to undo. The Tenfast resync has to run last:
 * Tenfast pulls our contact, so an earlier trigger would read the old state.
 */
export const addRelation = async (
  params: RelationRef & { createdBy: string }
): Promise<AddRelationResult> => {
  const economy = await syncRelatedContactToEconomy(params)
  if (!economy.ok) {
    // The recipient is looked up before the relation is written, so answer a
    // bad contact code the way the relation write would have — otherwise the
    // caseworker gets an outage error for their own typo.
    return economy.err === 'contact-not-found'
      ? {
          processStatus: ProcessStatus.failed,
          error: 'related-not-found',
          httpStatus: 404,
        }
      : propagationFailed('economy')
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
      //
      // Any answer to the compensating remove alarms, `relation-not-found`
      // included: a lost response usually means core stopped waiting while
      // the service was still working, so the remove can arrive before the
      // original insert commits and the relation still lands afterwards.
      if (presenceBefore === 'absent') {
        const compensated = await contactsAdapter.removeRelation({
          contactCode: params.contactCode,
          relatedContactCode: params.relatedContactCode,
          roleType: params.roleType,
          deletedBy: rollbackActor(params.createdBy),
        })
        if (!compensated.ok) {
          void alarmRollbackFailed({
            action: 'add',
            relation: params,
            actor: params.createdBy,
            economyCustomerTouched:
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
          economyCustomerTouched: params.roleType === 'annan_fakturamottagare',
          outcome: { kind: 'write-outcome-unknown' },
        })
      }
    }

    // Not when the relation was already there: that customer is in use.
    if (presenceBefore !== 'present') {
      logOrphanedEconomyCustomer(params, added.err)
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
        economyCustomerTouched: params.roleType === 'annan_fakturamottagare',
        outcome: {
          kind: 'rollback-failed',
          propagationError: synced.err,
          rollbackError: rolledBack.err,
        },
      })
      return rollbackFailed()
    }

    logOrphanedEconomyCustomer(params, 'propagation-failed')

    // Tenfast pulls our contact, so if the original push landed before we
    // lost the response it may already hold the relation we just removed.
    //
    // Alarms on any failure here, not just a lost response: leasing answers
    // 500 both when Tenfast rejected the push and when Tenfast's own response
    // was lost, so `sync-failed` does not mean Tenfast is untouched. Telling
    // those apart needs a distinct error code out of leasing's sync route.
    const resynced = await syncContactToLeasing(params.contactCode)
    if (!resynced.ok) {
      void alarmRollbackFailed({
        action: 'add',
        relation: params,
        actor: params.createdBy,
        economyCustomerTouched: params.roleType === 'annan_fakturamottagare',
        outcome: {
          kind: 'resync-unconfirmed',
          propagationError: synced.err,
          resyncError: resynced.err,
        },
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
 * No economy step: customers are never deleted, and the recipient may still
 * be invoiced under another lease or relation.
 */
export const removeRelation = async (
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
      //
      // `duplicate-relation` from the compensating add alarms for the same
      // reason as `relation-not-found` does in the add direction.
      if (presenceBefore === 'present') {
        const compensated = await contactsAdapter.addRelation({
          contactCode: params.contactCode,
          relatedContactCode: params.relatedContactCode,
          roleType: params.roleType,
          createdBy: rollbackActor(params.deletedBy),
        })
        if (!compensated.ok) {
          void alarmRollbackFailed({
            action: 'remove',
            relation: params,
            actor: params.deletedBy,
            economyCustomerTouched: false,
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
          economyCustomerTouched: false,
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
        economyCustomerTouched: false,
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
      void alarmRollbackFailed({
        action: 'remove',
        relation: params,
        actor: params.deletedBy,
        economyCustomerTouched: false,
        outcome: {
          kind: 'resync-unconfirmed',
          propagationError: synced.err,
          resyncError: resynced.err,
        },
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
