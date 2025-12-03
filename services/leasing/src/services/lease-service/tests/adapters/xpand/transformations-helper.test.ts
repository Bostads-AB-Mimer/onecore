import * as rentalObjectAdapter from '../../../adapters/xpand/transformations-helper'

const baseYear = new Date().getFullYear() + 5

describe('transformations-helper', () => {
  it('should get monthly rent for a vacantFrom in the past', () => {
    const baseYear = new Date().getFullYear()

    //Arrange
    const yearRentRows = [
      {
        yearrent: 12405.81,
        debittodate: `${baseYear}-12-31T00:00:00`,
        debitfdate: `${baseYear}-01-01T00:00:00`,
      },
      {
        yearrent: -2418.01,
        debittodate: `${baseYear}-12-31T00:00:00`,
        debitfdate: `${baseYear}-01-01T00:00:00`,
      },
      { yearrent: 12653.93, debitfdate: `${baseYear + 1}-01-01T00:00:00` },
      { yearrent: -2466.37, debitfdate: `${baseYear + 1}-01-01T00:00:00` },
    ]
    const vacantFrom = new Date('2021-05-01T00:00:00.000Z')

    //Act
    const result = rentalObjectAdapter.calculateMonthlyRentFromYearRentRows(
      yearRentRows,
      vacantFrom
    )

    //Assert
    expect(result).toBe(832.3166666666666)
  })

  it('should return 0 if yearRentRows is empty', () => {
    // Arrange
    const yearRentRows: any[] = []
    const vacantFrom = new Date(`${baseYear}-01-01T00:00:00.000Z`)

    // Act
    const result = rentalObjectAdapter.calculateMonthlyRentFromYearRentRows(
      yearRentRows,
      vacantFrom
    )

    // Assert
    expect(result).toBe(0)
  })

  it('should return 0 if vacantFrom is undefined', () => {
    // Arrange
    const yearRentRows = [
      {
        yearrent: 10000,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
    ]

    // Act
    const result = rentalObjectAdapter.calculateMonthlyRentFromYearRentRows(
      yearRentRows,
      undefined
    )

    // Assert
    expect(result).toBe(0)
  })

  it('should ignore rows with invalid yearrent values', () => {
    // Arrange
    const yearRentRows = [
      {
        yearrent: 10000,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: 'not-a-number',
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: NaN,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: null,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
    ]
    const vacantFrom = new Date(`${baseYear}-06-01T00:00:00.000Z`)

    // Act
    const result = rentalObjectAdapter.calculateMonthlyRentFromYearRentRows(
      yearRentRows,
      vacantFrom
    )

    // Assert
    expect(result).toBe(10000 / 12)
  })

  it('should only include rows where vacantFrom falls within debitfdate and debittodate interval', () => {
    // Arrange
    const yearRentRows = [
      {
        yearrent: 12000,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: 6000,
        debitfdate: `${baseYear + 1}-01-01T00:00:00`,
        debittodate: `${baseYear + 1}-12-31T00:00:00`,
      },
      {
        yearrent: 8000,
        debitfdate: `${baseYear - 1}-01-01T00:00:00`,
        debittodate: `${baseYear - 1}-12-31T00:00:00`,
      },
      {
        yearrent: 5000,
        debitfdate: `${baseYear}-06-01T00:00:00`,
        debittodate: `${baseYear}-06-30T00:00:00`,
      },
    ]
    // vacantFrom only matches first and last row
    const vacantFrom = new Date(`${baseYear}-06-15T00:00:00.000Z`)

    // Act
    const result = rentalObjectAdapter.calculateMonthlyRentFromYearRentRows(
      yearRentRows,
      vacantFrom
    )

    // Assert
    expect(result).toBe((12000 + 5000) / 12)
  })

  it('should handle rows where debitfdate or debittodate is null', () => {
    // Arrange
    const baseYear = new Date().getFullYear() + 5
    const yearRentRows = [
      {
        yearrent: 12000,
        debitfdate: null, // start date missing
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: 6000,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: null, // end date missing
      },
      {
        yearrent: 8000,
        debitfdate: null, // start date missing
        debittodate: null, // end date missing
      },
      {
        yearrent: 5000,
        debitfdate: `${baseYear + 1}-01-01T00:00:00`,
        debittodate: `${baseYear + 1}-12-31T00:00:00`,
      },
    ]
    // vacantFrom matches the first three rows to match, but not the last
    const vacantFrom = new Date(`${baseYear}-06-15T00:00:00.000Z`)

    // Act
    const result = rentalObjectAdapter.calculateMonthlyRentFromYearRentRows(
      yearRentRows,
      vacantFrom
    )

    // Assert
    expect(result).toBe(26000 / 12)
  })

  it('should calculate correct monthly rent when all yearrent values are positive', () => {
    // Arrange:
    const yearRentRows = [
      {
        yearrent: 12000,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: 6000,
        debitfdate: `${baseYear}-06-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: 8000,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-08-30T00:00:00`,
      },
    ]
    // vacantFrom matches all intervals
    const vacantFrom = new Date(`${baseYear}-07-01T00:00:00.000Z`)

    // Act:
    const result = rentalObjectAdapter.calculateMonthlyRentFromYearRentRows(
      yearRentRows,
      vacantFrom
    )

    // Assert:
    expect(result).toBe((12000 + 6000 + 8000) / 12)
  })
  it('should calculate correct monthly rent when some yearrent values are negative', () => {
    // Arrange:
    const yearRentRows = [
      {
        yearrent: 12000,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: -4000,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: 8000,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-06-30T00:00:00`,
      },
      {
        yearrent: -2000,
        debitfdate: `${baseYear}-06-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
    ]
    const vacantFrom = new Date(`${baseYear}-07-01T00:00:00.000Z`)

    // Act:
    const result = rentalObjectAdapter.calculateMonthlyRentFromYearRentRows(
      yearRentRows,
      vacantFrom
    )

    // Assert:
    expect(result).toBe(6000 / 12)
  })
  it('should handle floating point precision correctly', () => {
    // Arrange
    const yearRentRows = [
      {
        yearrent: 0.1,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: 0.2,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: 0.3,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
    ]
    const vacantFrom = new Date(`${baseYear}-06-15T00:00:00.000Z`)

    // Act
    const result = rentalObjectAdapter.calculateMonthlyRentFromYearRentRows(
      yearRentRows,
      vacantFrom
    )

    // Assert
    expect(result).toBeCloseTo(0.05, 10)
  })

  it('should return correct monthly rent when only one row matches the interval', () => {
    // Arrange
    const yearRentRows = [
      {
        yearrent: 12000,
        debitfdate: `${baseYear}-01-01T00:00:00`,
        debittodate: `${baseYear}-12-31T00:00:00`,
      },
      {
        yearrent: 6000,
        debitfdate: `${baseYear + 1}-01-01T00:00:00`,
        debittodate: `${baseYear + 1}-12-31T00:00:00`,
      },
      {
        yearrent: 8000,
        debitfdate: `${baseYear - 1}-01-01T00:00:00`,
        debittodate: `${baseYear - 1}-12-31T00:00:00`,
      },
    ]
    // vacantFrom only matches the first row
    const vacantFrom = new Date(`${baseYear}-06-15T00:00:00.000Z`)

    // Act
    const result = rentalObjectAdapter.calculateMonthlyRentFromYearRentRows(
      yearRentRows,
      vacantFrom
    )

    // Assert
    expect(result).toBe(12000 / 12)
  })
})
