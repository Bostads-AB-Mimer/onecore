import { isAxiosError } from 'axios'
import { z } from 'zod'
import { logger } from '@onecore/utilities'
import { WaitingListType } from '@onecore/types'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import { makeClientApplicationProfileRequestParams } from '../../services/lease-service/helpers/application-profile'
import { schemas } from '../../services/lease-service/schemas'

export type NewContactApplicationProfile = z.infer<
  typeof schemas.client.applicationProfile.UpdateApplicationProfileRequestParams
>

export type ApplicationProfileOutcome = {
  status: 'created' | 'skipped' | 'failed'
  error?: string
}

export type WaitingListOutcome = {
  waitingListType: WaitingListType
  status: 'created' | 'failed'
  error?: string
}

export type ApplicationProfileAndWaitingListsResult = {
  applicationProfile: ApplicationProfileOutcome
  waitingLists: WaitingListOutcome[]
  /** One per failed step, written for a caseworker to read, in Swedish. */
  warnings: string[]
}

/** Swedish queue names for caseworker-facing warnings. */
const WAITING_LIST_LABELS: Record<WaitingListType, string> = {
  [WaitingListType.Housing]: 'bostad',
  [WaitingListType.ParkingSpace]: 'bilplats',
  [WaitingListType.Storage]: 'förråd',
}

/**
 * Records the household details and enrols a newly created contact in the
 * requested waiting lists.
 *
 * Runs after the contact exists in Xpand, which cannot be undone, so it never
 * throws or fails as a whole: each step reports its own outcome, and every
 * failed step adds a warning. Both steps are idempotent, so a caller can
 * complete a failed step later on the same contact instead of creating it
 * again.
 *
 * Which Xpand queues a waiting list type covers, and treating a queue the
 * contact is already in as success, is decided by the leasing service.
 */
export const setUpApplicationProfileAndWaitingLists = async (
  contactCode: string,
  {
    applicationProfile,
    waitingLists,
  }: {
    applicationProfile?: NewContactApplicationProfile
    waitingLists: WaitingListType[]
  }
): Promise<ApplicationProfileAndWaitingListsResult> => {
  const warnings: string[] = []

  let profileOutcome: ApplicationProfileOutcome = { status: 'skipped' }

  if (applicationProfile) {
    const result =
      await leasingAdapter.createOrUpdateApplicationProfileByContactCode(
        contactCode,
        // A new contact has no profile yet, so there is no review verdict to
        // carry forward.
        makeClientApplicationProfileRequestParams(applicationProfile, undefined)
      )

    if (result.ok) {
      profileOutcome = { status: 'created' }
    } else {
      profileOutcome = { status: 'failed', error: result.err }
      warnings.push(
        'Kunden skapades men hushållsuppgifterna kunde inte sparas.'
      )
      logger.error(
        { contactCode, err: result.err },
        'setUpApplicationProfileAndWaitingLists.applicationProfileFailed'
      )
    }
  }

  const waitingListOutcomes: WaitingListOutcome[] = []

  const failedWaitingList = (
    waitingListType: WaitingListType,
    error: string
  ) => {
    waitingListOutcomes.push({ waitingListType, status: 'failed', error })
    warnings.push(
      `Kunden skapades men kunde inte ställas i kön för ${WAITING_LIST_LABELS[waitingListType]}.`
    )
  }

  // Sequential rather than concurrent: these are writes against the same
  // contact, and Xpand's own registration flow issues them one at a time.
  for (const waitingListType of waitingLists) {
    try {
      const res = await leasingAdapter.addApplicantToWaitingList(
        contactCode,
        waitingListType
      )

      // The status has to be checked explicitly: the adapter returns the raw
      // axios response, and the shared instance treats everything below 500
      // as a resolved call. Without this a 404 from leasing would be reported
      // to the caseworker as a queue the customer is now in.
      if (res.status === 201) {
        waitingListOutcomes.push({ waitingListType, status: 'created' })
      } else {
        failedWaitingList(waitingListType, String(res.status))
        logger.error(
          { contactCode, waitingListType, status: res.status },
          'setUpApplicationProfileAndWaitingLists.addToWaitingListRejected'
        )
      }
    } catch (err: unknown) {
      failedWaitingList(waitingListType, 'unknown')
      logger.error(
        {
          contactCode,
          waitingListType,
          status: isAxiosError(err) ? err.response?.status : undefined,
          error: err instanceof Error ? err.message : String(err),
        },
        'setUpApplicationProfileAndWaitingLists.addToWaitingListFailed'
      )
    }
  }

  return {
    applicationProfile: profileOutcome,
    waitingLists: waitingListOutcomes,
    warnings,
  }
}
