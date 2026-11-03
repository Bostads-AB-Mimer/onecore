import { ApiError } from '@/services/api/core/apiError'

/**
 * Outcome of closing the work order of a team that lost all its components:
 * 'closed', 'refused' (Odoo refused with a business rule, e.g. a component
 * without an outcome — someone is already handling the ärende) or 'failed'.
 */
export type StaleCloseResult = 'closed' | 'refused' | 'failed'

export const staleCloseResult = (error: unknown): StaleCloseResult =>
  error instanceof ApiError && error.status === 409 ? 'refused' : 'failed'

/**
 * Closed and refused teams are released — retrying a refusal can't succeed
 * until someone acts in Odoo. Failed teams stay for a retry.
 */
export const summarizeStaleCloses = (
  outcomes: { teamId: number; result: StaleCloseResult }[]
) => ({
  releasedTeamIds: outcomes
    .filter((outcome) => outcome.result !== 'failed')
    .map((outcome) => outcome.teamId),
  refusedTeamIds: outcomes
    .filter((outcome) => outcome.result === 'refused')
    .map((outcome) => outcome.teamId),
  failedTeamIds: outcomes
    .filter((outcome) => outcome.result === 'failed')
    .map((outcome) => outcome.teamId),
})
