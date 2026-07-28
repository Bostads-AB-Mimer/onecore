import {
  evaluateSendAt,
  MAX_SCHEDULE_DAYS_AHEAD,
  SCHEDULE_GRACE_SECONDS,
} from '../schedule'

describe(evaluateSendAt, () => {
  const now = new Date('2026-07-14T12:00:00.000Z')
  const secondsFromNow = (s: number) =>
    new Date(now.getTime() + s * 1000).toISOString()
  const MAX_DAYS = MAX_SCHEDULE_DAYS_AHEAD.sms

  it('treats missing sendAt as immediate', () => {
    expect(evaluateSendAt(undefined, MAX_DAYS, now)).toEqual({
      kind: 'immediate',
    })
  })

  it('treats sendAt within the grace window as immediate, both sides of now', () => {
    expect(evaluateSendAt(secondsFromNow(0), MAX_DAYS, now)).toEqual({
      kind: 'immediate',
    })
    expect(
      evaluateSendAt(secondsFromNow(SCHEDULE_GRACE_SECONDS), MAX_DAYS, now)
    ).toEqual({ kind: 'immediate' })
    expect(
      evaluateSendAt(secondsFromNow(-SCHEDULE_GRACE_SECONDS), MAX_DAYS, now)
    ).toEqual({ kind: 'immediate' })
  })

  it('rejects sendAt in the past beyond the grace window', () => {
    const result = evaluateSendAt(
      secondsFromNow(-(SCHEDULE_GRACE_SECONDS + 1)),
      MAX_DAYS,
      now
    )
    expect(result).toMatchObject({ kind: 'invalid', code: 'SEND_AT_IN_PAST' })
  })

  it('schedules sendAt in the future beyond the grace window', () => {
    const sendAt = secondsFromNow(SCHEDULE_GRACE_SECONDS + 1)
    expect(evaluateSendAt(sendAt, MAX_DAYS, now)).toEqual({
      kind: 'scheduled',
      sendAt: new Date(sendAt),
    })
  })

  it('accepts sendAt just inside the max-days cap', () => {
    const sendAt = secondsFromNow(MAX_DAYS * 24 * 3600 - 60)
    expect(evaluateSendAt(sendAt, MAX_DAYS, now)).toEqual({
      kind: 'scheduled',
      sendAt: new Date(sendAt),
    })
  })

  it('rejects sendAt beyond the max-days cap', () => {
    const result = evaluateSendAt(
      secondsFromNow(MAX_DAYS * 24 * 3600 + 60),
      MAX_DAYS,
      now
    )
    expect(result).toMatchObject({
      kind: 'invalid',
      code: 'SEND_AT_TOO_FAR_AHEAD',
    })
  })

  it('enforces the channel-specific cap (email: 5 days)', () => {
    const sendAt = secondsFromNow(6 * 24 * 3600)
    expect(
      evaluateSendAt(sendAt, MAX_SCHEDULE_DAYS_AHEAD.email, now)
    ).toMatchObject({ kind: 'invalid', code: 'SEND_AT_TOO_FAR_AHEAD' })
    // The same instant is fine for SMS.
    expect(evaluateSendAt(sendAt, MAX_SCHEDULE_DAYS_AHEAD.sms, now)).toEqual({
      kind: 'scheduled',
      sendAt: new Date(sendAt),
    })
  })

  it('normalizes offset instants to the same UTC moment', () => {
    // 14:00+02:00 === 12:00Z === now -> immediate, proving comparisons are UTC
    expect(
      evaluateSendAt('2026-07-14T14:00:00.000+02:00', MAX_DAYS, now)
    ).toEqual({ kind: 'immediate' })
  })
})
