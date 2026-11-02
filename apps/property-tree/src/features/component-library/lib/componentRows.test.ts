import { describe, expect, it } from 'vitest'

import type { Component } from '@/services/types'

import {
  describeStructure,
  formatComponentCount,
  formatComponentPlace,
  formatComponentQuantity,
  formatInstallationDate,
  formatSek,
  formatWithUnit,
  getComponentColumnKeys,
  getComponentLocation,
  getInstallationDate,
} from './componentRows'

const component = (c: Record<string, unknown>) =>
  ({ id: 'c1', serialNumber: null, quantity: 1, ...c }) as unknown as Component

const installed = (structure: Record<string, unknown> | null, extra = {}) =>
  component({
    componentInstallations: [
      {
        installationDate: '2016-09-01',
        deinstallationDate: null,
        propertyObject: {
          propertyStructures: structure ? [structure] : [],
        },
        ...extra,
      },
    ],
  })

describe('getComponentColumnKeys', () => {
  it('shows model and serial number for equipment', () => {
    expect(getComponentColumnKeys('EQUIPMENT')).toEqual([
      'location',
      'model',
      'installed',
      'serialNumber',
    ])
  })

  it('shows specification and quantity for surfaces', () => {
    expect(getComponentColumnKeys('SURFACE')).toEqual([
      'location',
      'specifications',
      'quantity',
      'installed',
    ])
  })
})

describe('getComponentLocation', () => {
  it('puts the address above the flat and room of the active installation', () => {
    expect(
      getComponentLocation(
        installed({
          residenceCode: '0202',
          residenceName: 'HAGA PARKGATA 6 C',
          roomName: 'Kök',
          roomCode: 'KOK',
          rentalId: '123-456-01-0202',
        })
      )
    ).toEqual({
      address: 'HAGA PARKGATA 6 C',
      detail: '0202 · Kök',
      rentalId: '123-456-01-0202',
      roomCode: 'KOK',
    })
  })

  it('falls back to the room code', () => {
    expect(
      getComponentLocation(
        installed({ residenceCode: '0202', roomCode: 'BAD' })
      ).detail
    ).toBe('0202 · BAD')
  })

  it('leaves out a missing residence code', () => {
    expect(
      getComponentLocation(
        installed({ residenceCode: null, roomName: 'Tvättstuga' })
      ).detail
    ).toBe('Tvättstuga')
  })

  it('has no address line when the residence has no name', () => {
    expect(
      getComponentLocation(
        installed({ residenceCode: '0202', roomName: 'Kök' })
      ).address
    ).toBeNull()
  })

  it('says so when nothing is installed', () => {
    expect(
      getComponentLocation(component({ componentInstallations: [] }))
    ).toEqual({
      address: null,
      detail: 'Ej installerad',
      rentalId: null,
      roomCode: null,
    })
  })

  it('ignores ended installations', () => {
    expect(
      getComponentLocation(
        installed({ residenceCode: 'X' }, { deinstallationDate: '2020-01-01' })
      ).detail
    ).toBe('Ej installerad')
  })

  it('shows a dash when the installation has no structure', () => {
    expect(getComponentLocation(installed(null)).detail).toBe('-')
  })
})

describe('formatComponentPlace', () => {
  it('puts the address before the flat and room', () => {
    expect(
      formatComponentPlace(
        installed({
          residenceCode: '0202',
          residenceName: 'HAGA PARKGATA 6 C',
          roomName: 'Kök',
        })
      )
    ).toBe('HAGA PARKGATA 6 C, 0202 · Kök')
  })

  it('says so when nothing is installed', () => {
    expect(
      formatComponentPlace(component({ componentInstallations: [] }))
    ).toBe('Ej installerad')
  })
})

describe('describeStructure', () => {
  it('names an installation place the same way as the list', () => {
    expect(
      describeStructure({
        residenceCode: '0101',
        residenceName: 'GATAN 1',
        roomName: 'Bad',
      })
    ).toEqual({ address: 'GATAN 1', detail: '0101 · Bad' })
  })

  it('shows a dash without a structure', () => {
    expect(describeStructure(undefined)).toEqual({ address: null, detail: '-' })
  })
})

describe('formatInstallationDate', () => {
  it('formats a known date', () => {
    expect(formatInstallationDate('2016-09-01T00:00:00.000Z')).toBe(
      '2016-09-01'
    )
  })

  it('shows the import placeholder 1900-01-01 as unknown', () => {
    expect(formatInstallationDate('1900-01-01')).toBe('Okänt')
    expect(formatInstallationDate('1900-01-01T00:00:00.000Z')).toBe('Okänt')
  })

  it('shows any date up to 1900 as unknown', () => {
    expect(formatInstallationDate('1900-06-01')).toBe('Okänt')
    expect(formatInstallationDate('1899-12-30')).toBe('Okänt')
  })

  it('shows a dash without a date', () => {
    expect(formatInstallationDate(null)).toBe('-')
  })
})

describe('formatSek', () => {
  it('formats kronor without decimals', () => {
    expect(formatSek(8000).replace(/\s/g, ' ')).toBe('8 000 kr')
  })

  it('shows a dash for zero or nothing', () => {
    expect(formatSek(0)).toBe('-')
    expect(formatSek(null)).toBe('-')
  })
})

describe('formatWithUnit', () => {
  it('joins a value and its unit', () => {
    expect(formatWithUnit(24, 'mån')).toBe('24 mån')
    expect(formatWithUnit(12.5, 'år')).toBe('12,5 år')
  })

  it('shows a dash for zero or nothing', () => {
    expect(formatWithUnit(0, 'mån')).toBe('-')
    expect(formatWithUnit(null, 'år')).toBe('-')
  })
})

describe('getInstallationDate', () => {
  it('reads the active installation date', () => {
    expect(getInstallationDate(installed({ residenceCode: 'X' }))).toBe(
      '2016-09-01'
    )
  })

  it('is null when nothing is installed', () => {
    expect(getInstallationDate(component({}))).toBeNull()
  })
})

describe('formatComponentQuantity', () => {
  it('adds the subtype unit in Swedish number format', () => {
    expect(
      formatComponentQuantity(
        component({ quantity: 9.5, subtype: { quantityType: 'SQUARE_METER' } })
      )
    ).toBe('9,5 m²')
  })

  it('uses st for units', () => {
    expect(
      formatComponentQuantity(
        component({ quantity: 2, subtype: { quantityType: 'UNIT' } })
      )
    ).toBe('2 st')
  })

  it('shows the bare number without a subtype', () => {
    expect(formatComponentQuantity(component({ quantity: 3 }))).toBe('3')
  })

  it('shows a dash without a quantity', () => {
    expect(formatComponentQuantity(component({ quantity: null }))).toBe('-')
  })
})

describe('formatComponentCount', () => {
  it('groups thousands the Swedish way and marks a missing count', () => {
    expect(formatComponentCount(45958).replace(/\s/g, ' ')).toBe('45 958')
    expect(formatComponentCount(0)).toBe('0')
    expect(formatComponentCount(undefined)).toBe('-')
  })
})
