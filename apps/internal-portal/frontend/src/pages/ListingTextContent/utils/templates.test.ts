import { describe, expect, it } from 'vitest'
import type { ApartmentInfo, ParkingSpaceInfo } from '@onecore/types'

import {
  buildBlocksFromTemplate,
  isValidRoomCount,
  roomCountFromProperty,
} from './templates'
import { listingTextTemplates } from '../templates/listingTextTemplates'
import { toApiBlocks } from './contentBlocks'

const apartmentRooms = listingTextTemplates.find(
  (t) => t.id === 'apartment-rooms'
)!
const emptyHeadings = listingTextTemplates.find(
  (t) => t.id === 'empty-headings'
)!

const apartment = (roomCount: number | null): ApartmentInfo => ({
  rentalTypeCode: 'R',
  rentalType: 'Rental',
  address: 'Testgatan 1',
  code: 'TST',
  number: '1',
  type: 'Apartment',
  roomTypeCode: '2RK',
  roomCount,
  entrance: 'A',
  floor: '1',
  hasElevator: true,
  washSpace: 'In unit',
  area: 50,
  estateCode: 'TST',
  estate: 'Test Estate',
  buildingCode: 'TST',
  building: 'Test Building',
})

const parkingSpace: ParkingSpaceInfo = {
  rentalTypeCode: 'P',
  rentalType: 'Parking',
  address: 'Testgatan 1',
  code: 'P1',
}

describe('isValidRoomCount', () => {
  it('accepts whole numbers within bounds', () => {
    expect(isValidRoomCount(1)).toBe(true)
    expect(isValidRoomCount(15)).toBe(true)
  })

  it('rejects decimals and values outside bounds', () => {
    expect(isValidRoomCount(2.5)).toBe(false)
    expect(isValidRoomCount(0)).toBe(false)
    expect(isValidRoomCount(16)).toBe(false)
    expect(isValidRoomCount(NaN)).toBe(false)
  })
})

describe('roomCountFromProperty', () => {
  it('returns the room count of an apartment', () => {
    expect(roomCountFromProperty(apartment(2))).toBe(2)
  })

  it('returns undefined when the room count is unknown or out of bounds', () => {
    expect(roomCountFromProperty(apartment(null))).toBeUndefined()
    expect(roomCountFromProperty(apartment(0))).toBeUndefined()
    expect(roomCountFromProperty(apartment(20))).toBeUndefined()
  })

  it('returns undefined for non-apartments and missing objects', () => {
    expect(roomCountFromProperty(parkingSpace)).toBeUndefined()
    expect(roomCountFromProperty(undefined)).toBeUndefined()
  })
})

describe('buildBlocksFromTemplate', () => {
  it('repeats the room section once per room after the fixed blocks', () => {
    const blocks = buildBlocksFromTemplate(apartmentRooms, 3)

    expect(blocks).toHaveLength(apartmentRooms.blocks.length + 3 * 2)
    expect(blocks.map((b) => b.type)).toEqual([
      'headline',
      'preamble',
      'subtitle',
      'bold_text',
      'text',
      'bold_text',
      'text',
      'bold_text',
      'text',
    ])
  })

  it('ignores the room count for templates without a room section', () => {
    const blocks = buildBlocksFromTemplate(emptyHeadings, 5)

    expect(blocks).toHaveLength(emptyHeadings.blocks.length)
  })

  it('maps prefilled content and placeholders, defaulting content to empty', () => {
    const blocks = buildBlocksFromTemplate(apartmentRooms, 1)

    expect(blocks[0]).toMatchObject({
      type: 'headline',
      content: '',
      placeholder: 'Här skriver du en säljande rubrik',
    })
    expect(blocks[2]).toMatchObject({
      type: 'subtitle',
      content: 'Om lägenheten',
    })
    expect(blocks[2].placeholder).toBeUndefined()
  })

  it('gives every block a unique id', () => {
    const blocks = buildBlocksFromTemplate(apartmentRooms, 4)
    const ids = new Set(blocks.map((b) => b.id))

    expect(ids.size).toBe(blocks.length)
    blocks.forEach((b) => expect(b.id).toBeTruthy())
  })

  it('produces blocks whose API shape carries no placeholder', () => {
    const apiBlocks = toApiBlocks(buildBlocksFromTemplate(apartmentRooms, 1))

    apiBlocks.forEach((b) => expect(b).not.toHaveProperty('placeholder'))
    apiBlocks.forEach((b) => expect(b).not.toHaveProperty('id'))
  })
})

describe('listingTextTemplates', () => {
  it('only prefills content for fixed headings, never object-specific claims', () => {
    const prefilled = listingTextTemplates
      .flatMap((t) => [...t.blocks, ...(t.roomSection?.blocks ?? [])])
      .filter((b) => b.content)

    prefilled.forEach((b) => {
      expect(b.type).toBe('subtitle')
    })
  })
})
