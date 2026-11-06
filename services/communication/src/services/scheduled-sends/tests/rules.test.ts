import {
  evaluateSendAt,
  isInBlockedHours,
  isOnSlotBoundary,
  localMinutesOfDay,
  nextOpenSlot,
  nextSlotBoundary,
  parseHHmm,
  SCHEDULE_GRACE_SECONDS,
  ScheduleRules,
  toScheduleConfig,
} from '../rules'

const rules: ScheduleRules = {
  enabled: true,
  blockedFrom: '21:00',
  blockedUntil: '07:00',
  maxDaysAhead: 30,
}

describe('parseHHmm', () => {
  it('parses HH:mm to minutes of day', () => {
    expect(parseHHmm('07:00')).toBe(420)
    expect(parseHHmm('21:30')).toBe(1290)
  })
  it('throws on malformed values', () => {
    expect(() => parseHHmm('7')).toThrow()
    expect(() => parseHHmm('25:00')).toThrow()
    expect(() => parseHHmm('07:60')).toThrow()
  })
})

describe('localMinutesOfDay (Europe/Stockholm)', () => {
  it('applies CEST (+02) in summer', () => {
    // 12:00Z = 14:00 local
    expect(localMinutesOfDay(new Date('2026-07-14T12:00:00Z'))).toBe(840)
  })
  it('applies CET (+01) in winter', () => {
    // 12:00Z = 13:00 local
    expect(localMinutesOfDay(new Date('2026-01-14T12:00:00Z'))).toBe(780)
  })
})

describe('isInBlockedHours', () => {
  it('blocks the overnight window inclusive of its start, exclusive of its end', () => {
    // Summer: 19:00Z = 21:00 local (blocked), 18:50Z = 20:50 (open)
    expect(isInBlockedHours(new Date('2026-07-14T19:00:00Z'), rules)).toBe(true)
    expect(isInBlockedHours(new Date('2026-07-14T18:50:00Z'), rules)).toBe(
      false
    )
    // 05:00Z = 07:00 local (open again), 04:50Z = 06:50 (blocked)
    expect(isInBlockedHours(new Date('2026-07-15T05:00:00Z'), rules)).toBe(
      false
    )
    expect(isInBlockedHours(new Date('2026-07-15T04:50:00Z'), rules)).toBe(true)
  })
  it('handles a same-day window', () => {
    const dayRules = { ...rules, blockedFrom: '12:00', blockedUntil: '13:00' }
    // 10:30Z = 12:30 local in summer
    expect(isInBlockedHours(new Date('2026-07-14T10:30:00Z'), dayRules)).toBe(
      true
    )
    expect(isInBlockedHours(new Date('2026-07-14T11:30:00Z'), dayRules)).toBe(
      false
    )
  })
  it('treats from === until as no window', () => {
    const none = { ...rules, blockedFrom: '00:00', blockedUntil: '00:00' }
    expect(isInBlockedHours(new Date('2026-07-14T22:00:00Z'), none)).toBe(false)
  })
})

describe('slots', () => {
  it('recognises 10-minute boundaries', () => {
    expect(isOnSlotBoundary(new Date('2026-07-14T12:10:00.000Z'))).toBe(true)
    expect(isOnSlotBoundary(new Date('2026-07-14T12:15:00.000Z'))).toBe(false)
    expect(isOnSlotBoundary(new Date('2026-07-14T12:10:00.500Z'))).toBe(false)
  })
  it('nextSlotBoundary is strictly after the input', () => {
    expect(nextSlotBoundary(new Date('2026-07-14T12:10:00Z'))).toEqual(
      new Date('2026-07-14T12:20:00Z')
    )
    expect(nextSlotBoundary(new Date('2026-07-14T12:13:37Z'))).toEqual(
      new Date('2026-07-14T12:20:00Z')
    )
  })
  it('nextOpenSlot skips the blocked window', () => {
    // 18:55Z (20:55 local) -> 05:00Z next day (07:00 local), not 19:00Z
    expect(nextOpenSlot(new Date('2026-07-14T18:55:00Z'), rules)).toEqual(
      new Date('2026-07-15T05:00:00Z')
    )
    // Open hours: just the next boundary.
    expect(nextOpenSlot(new Date('2026-07-14T10:01:00Z'), rules)).toEqual(
      new Date('2026-07-14T10:10:00Z')
    )
  })
  it('nextOpenSlot is DST-correct across the autumn change', () => {
    // 2026-10-25 03:00 CEST -> 02:00 CET. 20:50 local on the 24th is 18:50Z;
    // 07:00 local on the 25th is 06:00Z (CET).
    expect(nextOpenSlot(new Date('2026-10-24T18:55:00Z'), rules)).toEqual(
      new Date('2026-10-25T06:00:00Z')
    )
  })
})

describe('evaluateSendAt', () => {
  // Tuesday 14:00 local in summer, open hours.
  const now = new Date('2026-07-14T12:00:00.000Z')
  const minutesFromNow = (m: number) =>
    new Date(now.getTime() + m * 60 * 1000).toISOString()

  it('treats missing sendAt as immediate', () => {
    expect(evaluateSendAt(undefined, rules, now)).toEqual({ kind: 'immediate' })
  })

  it('rejects any sendAt while scheduling is disabled', () => {
    expect(
      evaluateSendAt(minutesFromNow(60), { ...rules, enabled: false }, now)
    ).toMatchObject({ kind: 'invalid', code: 'SCHEDULING_DISABLED' })
  })

  it('treats sendAt within the grace window as immediate, both sides of now', () => {
    const sec = (s: number) => new Date(now.getTime() + s * 1000).toISOString()
    expect(evaluateSendAt(sec(0), rules, now)).toEqual({ kind: 'immediate' })
    expect(evaluateSendAt(sec(SCHEDULE_GRACE_SECONDS), rules, now)).toEqual({
      kind: 'immediate',
    })
    expect(evaluateSendAt(sec(-SCHEDULE_GRACE_SECONDS), rules, now)).toEqual({
      kind: 'immediate',
    })
  })

  it('rejects sendAt in the past beyond the grace window', () => {
    expect(evaluateSendAt(minutesFromNow(-10), rules, now)).toMatchObject({
      kind: 'invalid',
      code: 'SEND_AT_IN_PAST',
    })
  })

  it('schedules a future slot in open hours', () => {
    const sendAt = minutesFromNow(60)
    expect(evaluateSendAt(sendAt, rules, now)).toEqual({
      kind: 'scheduled',
      sendAt: new Date(sendAt),
    })
  })

  it('rejects sendAt beyond max days ahead', () => {
    expect(
      evaluateSendAt(minutesFromNow(31 * 24 * 60), rules, now)
    ).toMatchObject({ kind: 'invalid', code: 'SEND_AT_TOO_FAR_AHEAD' })
    expect(
      evaluateSendAt(minutesFromNow(30 * 24 * 60 - 10), rules, now)
    ).toMatchObject({ kind: 'scheduled' })
  })

  it('rejects sendAt off the 10-minute slot grid', () => {
    expect(evaluateSendAt(minutesFromNow(65), rules, now)).toMatchObject({
      kind: 'invalid',
      code: 'SEND_AT_OFF_SLOT',
    })
    expect(
      evaluateSendAt(
        new Date(now.getTime() + 60 * 60 * 1000 + 500).toISOString(),
        rules,
        now
      )
    ).toMatchObject({ kind: 'invalid', code: 'SEND_AT_OFF_SLOT' })
  })

  it('rejects sendAt inside blocked hours (Swedish local time)', () => {
    // 19:00Z = 21:00 local: first blocked slot
    expect(
      evaluateSendAt('2026-07-14T19:00:00.000Z', rules, now)
    ).toMatchObject({ kind: 'invalid', code: 'SEND_AT_IN_BLOCKED_HOURS' })
    // 18:50Z = 20:50 local: last open slot
    expect(evaluateSendAt('2026-07-14T18:50:00.000Z', rules, now)).toEqual({
      kind: 'scheduled',
      sendAt: new Date('2026-07-14T18:50:00.000Z'),
    })
    // 05:00Z next day = 07:00 local: first open slot
    expect(evaluateSendAt('2026-07-15T05:00:00.000Z', rules, now)).toEqual({
      kind: 'scheduled',
      sendAt: new Date('2026-07-15T05:00:00.000Z'),
    })
  })

  it('normalizes offset instants to the same UTC moment', () => {
    // 14:00+02:00 === 12:00Z === now -> immediate, proving comparisons are UTC
    expect(evaluateSendAt('2026-07-14T14:00:00.000+02:00', rules, now)).toEqual(
      { kind: 'immediate' }
    )
  })
})

describe('toScheduleConfig', () => {
  it('exposes the rules the picker mirrors', () => {
    expect(toScheduleConfig(rules)).toEqual({
      enabled: true,
      timeZone: 'Europe/Stockholm',
      slotMinutes: 10,
      blockedHours: { from: '21:00', until: '07:00' },
      maxDaysAhead: 30,
    })
  })
})
