import { describe, expect, it } from 'vitest'

import { ApiError } from '@/services/api/core/apiError'

import {
  endHomeInsuranceErrorMessage,
  endHomeInsuranceFormSchema,
  planEnd,
} from './homeInsuranceEnd'

const row = { from: '2026-01-01', to: undefined }

describe('planEnd', () => {
  it('deletes on cancel on or before the first day', () => {
    expect(planEnd(row, '2026-01-01', 'cancel')).toBe('delete')
    expect(planEnd(row, '2025-12-31', 'cancel')).toBe('delete')
    expect(planEnd(row, '2026-01-02', 'cancel')).toBe('replace')
  })

  it('refuses set-end before the first day, but not on it', () => {
    expect(planEnd(row, '2025-12-31', 'set-end')).toBe('end-date-before-start')
    expect(planEnd(row, '2026-01-01', 'set-end')).toBe('replace')
  })

  it('refuses an unchanged end date, unless the cancel deletes', () => {
    const ended = { from: '2026-01-01', to: '2026-06-30' }
    expect(planEnd(ended, '2026-06-30', 'set-end')).toBe('end-date-unchanged')
    expect(
      planEnd({ from: '2026-01-01', to: '2026-01-01' }, '2026-01-01', 'cancel')
    ).toBe('delete')
  })

  it('has no lower bound for a row without a first day', () => {
    expect(planEnd({}, '2000-01-01', 'cancel')).toBe('replace')
    expect(planEnd({}, '2000-01-01', 'set-end')).toBe('replace')
  })
})

describe('endHomeInsuranceFormSchema', () => {
  it('flags the end date only when the backend would refuse it', () => {
    const schema = endHomeInsuranceFormSchema(row)
    const day = new Date(2025, 11, 31)
    expect(schema.safeParse({ action: 'cancel', endDate: day }).success).toBe(
      true
    )
    const result = schema.safeParse({ action: 'set-end', endDate: day })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['endDate'])
  })
})

describe('endHomeInsuranceErrorMessage', () => {
  it('maps codes, then statuses, never the server text', () => {
    const error = (status: number, code?: string) =>
      new ApiError(status, 'server text', code)

    expect(
      endHomeInsuranceErrorMessage(error(409, 'home-insurance-row-changed'))
    ).toBe(
      'Din ändring sparades inte: någon annan hade ändrat raden innan. Listan visar nu raden som den är.'
    )
    expect(endHomeInsuranceErrorMessage(error(400))).toBe(
      'Uppgifterna är ogiltiga. Kontrollera datumet.'
    )
    expect(endHomeInsuranceErrorMessage(error(502))).toBe('Något gick fel.')
    expect(endHomeInsuranceErrorMessage('Forbidden')).toBe('Något gick fel.')
  })
})
