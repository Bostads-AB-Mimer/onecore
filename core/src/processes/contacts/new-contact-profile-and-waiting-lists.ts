import { isAxiosError } from 'axios'
import { logger } from '@onecore/utilities'
import { WaitingListType } from '@onecore/types'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import {
  makeClientApplicationProfileRequestParams,
  UpdateClientApplicationProfileRequestParams,
} from '../../services/lease-service/helpers/application-profile'

export type ApplicationProfileOutcome = {
  status: 'created' | 'skipped' | 'failed'
  error?: string
}

export type WaitingListOutcome = {
  waitingListType: WaitingListType
  status: 'created' | 'failed'
  /** Leasing's HTTP status, or 'unknown' when no answer came back. */
  error?: string
}

export type NewContactProfileAndWaitingListsResult = {
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

const PROFILE_WARNING =
  'Kunden skapades men hushållsuppgifterna kunde inte sparas.'

const waitingListWarning = (waitingListType: WaitingListType) =>
  `Kunden skapades men kunde inte ställas i kön för ${WAITING_LIST_LABELS[waitingListType]}.`

const saveProfile = async (
  contactCode: string,
  applicationProfile: UpdateClientApplicationProfileRequestParams | undefined
): Promise<ApplicationProfileOutcome> => {
  if (!applicationProfile) return { status: 'skipped' }

  const result =
    await leasingAdapter.createOrUpdateApplicationProfileByContactCode(
      contactCode,
      // No existing profile is read or passed: the contact was created a
      // moment ago, so there is no review verdict to carry forward.
      makeClientApplicationProfileRequestParams(applicationProfile, undefined)
    )

  if (result.ok) return { status: 'created' }

  logger.error(
    { contactCode, err: result.err },
    'setUpNewContactProfileAndWaitingLists.applicationProfileFailed'
  )
  return { status: 'failed', error: result.err }
}

const enrol = async (
  contactCode: string,
  waitingListType: WaitingListType
): Promise<WaitingListOutcome> => {
  try {
    const res = await leasingAdapter.addApplicantToWaitingList(
      contactCode,
      waitingListType
    )

    // The adapter returns the raw axios response, and the shared instance
    // resolves every status below 500, so a 404 from leasing arrives here and
    // must not be reported as a queue the customer is now in.
    if (res.status === 201) return { waitingListType, status: 'created' }

    logger.error(
      { contactCode, waitingListType, status: res.status },
      'setUpNewContactProfileAndWaitingLists.addToWaitingListRejected'
    )
    return { waitingListType, status: 'failed', error: String(res.status) }
  } catch (err: unknown) {
    // Leasing answers 500 for most real failures, which the shared instance
    // rejects; its body holds the reason.
    const status = isAxiosError<{ error?: unknown }>(err)
      ? err.response?.status
      : undefined
    const reason = isAxiosError<{ error?: unknown }>(err)
      ? err.response?.data?.error
      : undefined

    logger.error(
      {
        contactCode,
        waitingListType,
        status,
        error:
          typeof reason === 'string'
            ? reason
            : err instanceof Error
              ? err.message
              : String(err),
      },
      'setUpNewContactProfileAndWaitingLists.addToWaitingListFailed'
    )
    return {
      waitingListType,
      status: 'failed',
      error: status !== undefined ? String(status) : 'unknown',
    }
  }
}

const enrolAll = async (
  contactCode: string,
  waitingLists: WaitingListType[]
): Promise<WaitingListOutcome[]> => {
  const outcomes: WaitingListOutcome[] = []
  // Sequential rather than concurrent: these are writes against the same
  // contact, and Xpand's own registration flow issues them one at a time.
  for (const waitingListType of waitingLists) {
    outcomes.push(await enrol(contactCode, waitingListType))
  }
  return outcomes
}

/**
 * Records the household details of a contact created in the same request, and
 * enrols it in the requested waiting lists.
 *
 * Only for a brand new contact: the profile is written as new, so calling this
 * for a contact whose housing reference a caseworker has already reviewed
 * would reset the verdict to pending. A failed step is completed later through
 * the application profile and waiting list endpoints, not by calling this
 * again.
 *
 * Runs after the contact exists in Xpand, which cannot be undone, so it never
 * throws or fails as a whole: each step reports its own outcome, and every
 * failed step adds a warning.
 *
 * Which Xpand queues a waiting list type covers, and treating a queue the
 * contact is already in as success, is decided by the leasing service.
 */
export const setUpNewContactProfileAndWaitingLists = async (
  contactCode: string,
  {
    applicationProfile,
    waitingLists,
  }: {
    applicationProfile?: UpdateClientApplicationProfileRequestParams
    waitingLists: WaitingListType[]
  }
): Promise<NewContactProfileAndWaitingListsResult> => {
  // The profile lives in ONECore and the queues in Xpand, so neither waits for
  // the other.
  const [profileOutcome, waitingListOutcomes] = await Promise.all([
    saveProfile(contactCode, applicationProfile),
    enrolAll(contactCode, waitingLists),
  ])

  // Built after both finish so the order is fixed: profile first, then queues
  // in the order they were requested.
  const warnings = [
    ...(profileOutcome.status === 'failed' ? [PROFILE_WARNING] : []),
    ...waitingListOutcomes
      .filter((outcome) => outcome.status === 'failed')
      .map((outcome) => waitingListWarning(outcome.waitingListType)),
  ]

  return {
    applicationProfile: profileOutcome,
    waitingLists: waitingListOutcomes,
    warnings,
  }
}
