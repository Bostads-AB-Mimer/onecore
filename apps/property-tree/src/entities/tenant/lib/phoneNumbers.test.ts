import { describe, expect, it } from 'vitest'

import { findMainPhoneNumber, sortMainNumberFirst } from './phoneNumbers'

const phone = (phoneNumber: string, isMainNumber = false) => ({
  phoneNumber,
  isMainNumber,
})

const numbersOf = (phones: Array<{ phoneNumber: string }>) =>
  phones.map((p) => p.phoneNumber)

describe('sortMainNumberFirst', () => {
  it('returns an empty array for no numbers', () => {
    expect(sortMainNumberFirst([])).toEqual([])
  })

  it('moves the main number to the front', () => {
    const phones = [phone('1'), phone('2'), phone('3', true)]

    expect(numbersOf(sortMainNumberFirst(phones))).toEqual(['3', '1', '2'])
  })

  it('keeps the order when no number is main', () => {
    const phones = [phone('1'), phone('2'), phone('3')]

    expect(numbersOf(sortMainNumberFirst(phones))).toEqual(['1', '2', '3'])
  })

  it('keeps the relative order when several numbers are main', () => {
    const phones = [phone('1'), phone('2', true), phone('3'), phone('4', true)]

    expect(numbersOf(sortMainNumberFirst(phones))).toEqual(['2', '4', '1', '3'])
  })

  it('does not mutate the input array', () => {
    const phones = [phone('1'), phone('2', true)]

    sortMainNumberFirst(phones)

    expect(numbersOf(phones)).toEqual(['1', '2'])
  })
})

describe('findMainPhoneNumber', () => {
  it('returns undefined when there is no main number', () => {
    expect(findMainPhoneNumber(undefined)).toBeUndefined()
    expect(findMainPhoneNumber([])).toBeUndefined()
    expect(findMainPhoneNumber([phone('1'), phone('2')])).toBeUndefined()
  })

  it('returns the first main number', () => {
    const phones = [phone('1'), phone('2', true), phone('3', true)]

    expect(findMainPhoneNumber(phones)?.phoneNumber).toBe('2')
  })
})
