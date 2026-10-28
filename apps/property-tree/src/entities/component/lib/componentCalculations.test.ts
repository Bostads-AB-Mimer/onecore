import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Component } from '@/services/types'

import {
  calculateComponentAge,
  calculateComponentLifespanProgress,
  calculateComponentWarrantyStatus,
  componentEconomicLifespan,
  componentNeedsAttention,
  isKnownInstallationDate,
  knownLifespan,
} from './componentCalculations'

const component = (c: Partial<Component>) =>
  ({ id: 'c1', serialNumber: null, ...c }) as unknown as Component

const installedOn = (installationDate: string, technicalLifespan = 10) =>
  component({
    componentInstallations: [{ installationDate }] as never,
    subtype: { technicalLifespan } as never,
  })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-14T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isKnownInstallationDate', () => {
  it('rejects a missing date', () => {
    expect(isKnownInstallationDate(null)).toBe(false)
    expect(isKnownInstallationDate(undefined)).toBe(false)
    expect(isKnownInstallationDate('')).toBe(false)
  })

  it('rejects the import placeholder and anything older', () => {
    expect(isKnownInstallationDate('1900-01-01T00:00:00.000Z')).toBe(false)
    expect(isKnownInstallationDate('1900-12-31')).toBe(false)
    expect(isKnownInstallationDate('1899-06-01')).toBe(false)
  })

  it('reads the year in UTC', () => {
    expect(isKnownInstallationDate('1901-01-01T00:00:00.000Z')).toBe(true)
  })

  it('accepts a real date', () => {
    expect(isKnownInstallationDate('1901-01-01')).toBe(true)
    expect(isKnownInstallationDate('2024-03-01')).toBe(true)
  })
})

describe('calculateComponentAge', () => {
  it('counts years since a known installation', () => {
    expect(calculateComponentAge('2020-05-01')).toBe(6)
  })

  it('counts only whole elapsed years', () => {
    expect(calculateComponentAge('2016-12-15')).toBe(9)
    expect(calculateComponentAge('2016-10-14')).toBe(10)
  })

  it('has no age for the import placeholder', () => {
    expect(calculateComponentAge('1900-01-01')).toBeNull()
  })
})

describe('calculateComponentWarrantyStatus', () => {
  it('is unknown without a warranty start or length', () => {
    expect(calculateComponentWarrantyStatus(component({})).state).toBe(
      'unknown'
    )
    expect(
      calculateComponentWarrantyStatus(
        component({ warrantyStartDate: '2024-01-01', warrantyMonths: 0 })
      ).state
    ).toBe('unknown')
  })

  it('is active before the warranty ends', () => {
    const status = calculateComponentWarrantyStatus(
      component({ warrantyStartDate: '2025-01-01', warrantyMonths: 36 })
    )
    expect(status.state).toBe('active')
    expect(status.remaining).toBe('1 år kvar')
  })

  it('is expired after the warranty ends', () => {
    const status = calculateComponentWarrantyStatus(
      component({ warrantyStartDate: '2020-01-01', warrantyMonths: 24 })
    )
    expect(status.state).toBe('expired')
    expect(status.expiryDate?.getFullYear()).toBe(2022)
  })
})

describe('knownLifespan', () => {
  it('treats a missing or zero lifespan as unknown', () => {
    expect(knownLifespan(null)).toBeNull()
    expect(knownLifespan(undefined)).toBeNull()
    expect(knownLifespan(0)).toBeNull()
  })

  it('keeps a real lifespan', () => {
    expect(knownLifespan(15)).toBe(15)
  })
})

describe('componentEconomicLifespan', () => {
  it("prefers the component's own lifespan", () => {
    expect(
      componentEconomicLifespan(
        component({
          economicLifespan: 20,
          subtype: { economicLifespan: 15 } as never,
        })
      )
    ).toBe(20)
  })

  it('falls back to the subtype', () => {
    expect(
      componentEconomicLifespan(
        component({
          economicLifespan: 0,
          subtype: { economicLifespan: 15 } as never,
        })
      )
    ).toBe(15)
  })

  it('is unknown when neither has one', () => {
    expect(
      componentEconomicLifespan(
        component({ subtype: { economicLifespan: 0 } as never })
      )
    ).toBeNull()
  })
})

describe('calculateComponentLifespanProgress', () => {
  it('needs a known installation date', () => {
    expect(
      calculateComponentLifespanProgress(installedOn('1900-01-01'))
    ).toBeNull()
  })

  it('reports wear against the technical lifespan', () => {
    expect(
      calculateComponentLifespanProgress(installedOn('2021-01-01', 10))
    ).toEqual({ age: 5, percentage: 50, remaining: 5 })
  })
})

describe('componentNeedsAttention', () => {
  it('flags components under maintenance or out of service', () => {
    expect(componentNeedsAttention(component({ status: 'MAINTENANCE' }))).toBe(
      true
    )
    expect(
      componentNeedsAttention(component({ status: 'DECOMMISSIONED' }))
    ).toBe(true)
  })

  it('flags components past their technical lifespan', () => {
    expect(
      componentNeedsAttention({
        ...installedOn('2010-01-01', 10),
        status: 'ACTIVE',
      } as Component)
    ).toBe(true)
  })

  it('does not flag a component in the last year before its lifespan', () => {
    expect(
      componentNeedsAttention({
        ...installedOn('2016-12-15', 10),
        status: 'ACTIVE',
      } as Component)
    ).toBe(false)
  })

  it('does not flag an active component with an unknown age', () => {
    expect(
      componentNeedsAttention({
        ...installedOn('1900-01-01', 10),
        status: 'ACTIVE',
      } as Component)
    ).toBe(false)
  })
})
