import { describe, expect, it } from 'vitest'

import type { Component } from '@/services/types'

import {
  formatComponentQuantity,
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
  it('names the residence and room of the active installation', () => {
    expect(
      getComponentLocation(
        installed({
          residenceCode: '123-456-01',
          residenceName: 'Gatan 1',
          roomName: 'Kök',
          roomCode: 'KOK',
          rentalId: '123-456-01-0101',
        })
      )
    ).toEqual({
      label: '123-456-01 / Kök',
      rentalId: '123-456-01-0101',
      roomCode: 'KOK',
      tooltip: 'Gatan 1\nLägenhet: 123-456-01-0101',
    })
  })

  it('falls back to the room code', () => {
    expect(
      getComponentLocation(
        installed({ residenceCode: '123-456-01', roomCode: 'BAD' })
      ).label
    ).toBe('123-456-01 / BAD')
  })

  it('says so when nothing is installed', () => {
    expect(
      getComponentLocation(component({ componentInstallations: [] }))
    ).toEqual({
      label: 'Ej installerad',
      rentalId: null,
      roomCode: null,
      tooltip: '',
    })
  })

  it('ignores ended installations', () => {
    expect(
      getComponentLocation(
        installed({ residenceCode: 'X' }, { deinstallationDate: '2020-01-01' })
      ).label
    ).toBe('Ej installerad')
  })

  it('shows a dash when the installation has no structure', () => {
    expect(getComponentLocation(installed(null)).label).toBe('-')
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
