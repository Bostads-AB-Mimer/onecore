import { describe, expect, it } from 'vitest'

import { ApiError } from '@/services/api/core/apiError'

import { staleCloseResult, summarizeStaleCloses } from './staleWorkOrderCloses'

describe('staleCloseResult', () => {
  it('treats a 409 from core as a refusal', () => {
    expect(staleCloseResult(new ApiError(409, 'refused'))).toBe('refused')
  })

  it('treats any other API error as a failure', () => {
    expect(staleCloseResult(new ApiError(500, 'close-failed'))).toBe('failed')
  })

  it('treats a network error as a failure', () => {
    expect(staleCloseResult(new Error('Failed to fetch'))).toBe('failed')
  })
})

describe('summarizeStaleCloses', () => {
  it('releases closed and refused teams and keeps failed ones for a retry', () => {
    expect(
      summarizeStaleCloses([
        { teamId: 1, result: 'closed' },
        { teamId: 2, result: 'refused' },
        { teamId: 3, result: 'failed' },
      ])
    ).toEqual({
      releasedTeamIds: [1, 2],
      refusedTeamIds: [2],
      failedTeamIds: [3],
    })
  })

  it('returns empty lists when nothing was closed', () => {
    expect(summarizeStaleCloses([])).toEqual({
      releasedTeamIds: [],
      refusedTeamIds: [],
      failedTeamIds: [],
    })
  })
})
