import * as rentalObjectAdapter from '../../../adapters/xpand/rental-object-adapter'

describe('transformFromXpandRentalObject', () => {
  it('should set vacantFrom to today when lastDebitDate and blockEndDate are missing', () => {
    const row = {
      lastdebitdate: null,
      blockenddate: null,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    const today = new Date()
    const vacantFrom = new Date(result.vacantFrom)
    expect(vacantFrom.getUTCFullYear()).toBe(today.getUTCFullYear())
    expect(vacantFrom.getUTCMonth()).toBe(today.getUTCMonth())
    expect(vacantFrom.getUTCDate()).toBe(today.getUTCDate())
  })

  it('should set vacantFrom to the day after lastDebitDate when lastDebitDate is present and blockEndDate is missing', () => {
    const lastDebitDate = new Date()
    lastDebitDate.setUTCMonth(lastDebitDate.getUTCMonth() + 1)

    const row = {
      lastdebitdate: lastDebitDate,
      blockenddate: null,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    const vacantFrom = new Date(result.vacantFrom)
    expect(vacantFrom.getUTCFullYear()).toBe(lastDebitDate.getUTCFullYear())
    expect(vacantFrom.getUTCMonth()).toBe(lastDebitDate.getUTCMonth())
    expect(vacantFrom.getUTCDate()).toBe(lastDebitDate.getUTCDate() + 1)
  })

  it('should set vacantFrom to the day after blockEndDate when blockEndDate is in the future', () => {
    const blockEndDate = new Date()
    blockEndDate.setUTCMonth(blockEndDate.getUTCMonth() + 1)

    const row = {
      lastdebitdate: new Date(),
      blockenddate: blockEndDate,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    const vacantFrom = new Date(result.vacantFrom)
    expect(vacantFrom.getUTCFullYear()).toBe(blockEndDate.getUTCFullYear())
    expect(vacantFrom.getUTCMonth()).toBe(blockEndDate.getUTCMonth())
    expect(vacantFrom.getUTCDate()).toBe(blockEndDate.getUTCDate() + 1)
  })

  it('should set vacantFrom to the day after lastDebitDate when blockEndDate is in the past and lastDebitDate is present', () => {
    const lastDebitDate = new Date()
    lastDebitDate.setUTCMonth(lastDebitDate.getUTCMonth() + 1)

    const blockEndDate = new Date()
    blockEndDate.setUTCMonth(blockEndDate.getUTCMonth() - 1)

    const row = {
      lastdebitdate: lastDebitDate,
      blockenddate: blockEndDate,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    const vacantFrom = new Date(result.vacantFrom)
    expect(vacantFrom.getUTCFullYear()).toBe(lastDebitDate.getUTCFullYear())
    expect(vacantFrom.getUTCMonth()).toBe(lastDebitDate.getUTCMonth())
    expect(vacantFrom.getUTCDate()).toBe(lastDebitDate.getUTCDate() + 1)
  })

  it('should set vacantFrom to today when blockEndDate is in the past and lastDebitDate is missing', () => {
    const blockEndDate = new Date()
    blockEndDate.setUTCMonth(blockEndDate.getUTCMonth() - 1)

    const row = {
      lastdebitdate: null,
      blockenddate: blockEndDate,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    const vacantFrom = new Date(result.vacantFrom)
    const today = new Date()
    expect(vacantFrom.getUTCFullYear()).toBe(today.getUTCFullYear())
    expect(vacantFrom.getUTCMonth()).toBe(today.getUTCMonth())
    expect(vacantFrom.getUTCDate()).toBe(today.getUTCDate())
  })

  it('should set vacantFrom to start of day UTC', () => {
    const row = {
      lastdebitdate: null,
      blockenddate: null,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    const vacantFrom = new Date(result.vacantFrom)
    expect(vacantFrom.getUTCHours()).toBe(0)
    expect(vacantFrom.getUTCMinutes()).toBe(0)
    expect(vacantFrom.getUTCSeconds()).toBe(0)
  })
})
