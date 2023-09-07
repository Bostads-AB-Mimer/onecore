import { Rent, RentInfo } from '../types'

const getRentsForLease = async (leaseId: string): Promise<RentInfo> => {
  const applianceNames = ['tapet', 'torktumlare']

  const subtractYears = (date: Date, years: number): Date => {
    date.setMonth(date.getMonth() - 12 * years)
    return date
  }
  const addMonths = (date: Date, months: number): Date => {
    date.setMonth(date.getMonth() + months)
    return date
  }

  const rent = Math.round(Math.random() * 10000)

  return {
    currentRent: {
      rentId: Math.round(Math.random() * 1000).toString(),
      leaseId,
      currentRent: rent,
      additionalChargeDescription: 'Tillval för ' + applianceNames.join(', '),
      additionalChargeAmount: Math.round(Math.random() * 1000),
      rentStartDate: subtractYears(new Date(), 1),
      rentEndDate: addMonths(new Date(), 3),
    },
    futureRents: [
      {
        rentId: Math.round(Math.random() * 1000).toString(),
        leaseId,
        currentRent: rent + 500,
        additionalChargeDescription: undefined,
        additionalChargeAmount: undefined,
        rentStartDate: addMonths(new Date(), 3),
        rentEndDate: undefined,
      },
      {
        rentId: Math.round(Math.random() * 1000).toString(),
        leaseId,
        currentRent: rent + 1000,
        additionalChargeDescription: undefined,
        additionalChargeAmount: undefined,
        rentStartDate: addMonths(new Date(), 12 + 3),
        rentEndDate: undefined,
      },
      {
        rentId: Math.round(Math.random() * 1000).toString(),
        leaseId,
        currentRent: rent + 1500,
        additionalChargeDescription: undefined,
        additionalChargeAmount: undefined,
        rentStartDate: addMonths(new Date(), 24 + 3),
        rentEndDate: undefined,
      },
    ],
  }
}

export { getRentsForLease }
