import * as rentalObjectAdapter from '../../../adapters/xpand/rental-object-adapter'
import { addDays, addMonths } from 'date-fns'

describe('transformFromXpandRentalObject', () => {
  it('should set vacantFrom to today when lastDebitDate and blockEndDate are missing', () => {
    const row = {
      lastdebitdate: null,
      blockenddate: null,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    const today = new Date()

    expect(result.vacantFrom).toBeDefined()
    expect(result.vacantFrom).toBeSameDayAs(today)
  })

  it('should set vacantFrom to the day after lastDebitDate when lastDebitDate is present and blockEndDate is missing', () => {
    const lastDebitDate = new Date()
    lastDebitDate.setUTCMonth(lastDebitDate.getUTCMonth() + 1)

    const row = {
      lastdebitdate: lastDebitDate,
      blockenddate: null,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    const expectedVacantFrom = addDays(lastDebitDate, 1)
    expect(result.vacantFrom).toBeDefined()
    expect(result.vacantFrom).toBeSameDayAs(expectedVacantFrom)
  })

  it('should set vacantFrom to the day after blockEndDate when blockEndDate is in the future', () => {
    const blockEndDate = new Date()
    blockEndDate.setUTCMonth(blockEndDate.getUTCMonth() + 1)

    const row = {
      lastdebitdate: new Date(),
      blockenddate: blockEndDate,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    const expectedVacantFrom = addDays(blockEndDate, 1)
    expect(result.vacantFrom).toBeDefined()
    expect(result.vacantFrom).toBeSameDayAs(expectedVacantFrom)
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

    const expectedVacantFrom = addDays(lastDebitDate, 1)
    expect(result.vacantFrom).toBeDefined()
    expect(result.vacantFrom).toBeSameDayAs(expectedVacantFrom)
  })

  it('should set vacantFrom to today when blockEndDate is in the past and lastDebitDate is missing', () => {
    const blockEndDate = new Date()
    blockEndDate.setUTCMonth(blockEndDate.getUTCMonth() - 1)

    const row = {
      lastdebitdate: null,
      blockenddate: blockEndDate,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    const today = new Date()
    expect(result.vacantFrom).toBeDefined()
    expect(result.vacantFrom).toBeSameDayAs(today)
  })

  it('should set vacantFrom to start of day UTC', () => {
    const row = {
      lastdebitdate: null,
      blockenddate: null,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    expect(result.vacantFrom).toBeDefined()
    expect(result.vacantFrom).toBeStartOfDayUTC()
  })

  it('should set vacantFrom to undefined when there is a block without an end date', () => {
    const row = {
      blockstartdate: new Date(),
      blockenddate: null,
      lastdebitdate: null,
    }

    const result = rentalObjectAdapter.transformFromXpandRentalObject(row)

    expect(result.vacantFrom).toBeUndefined()
  })
})
