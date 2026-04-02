import { RentalObjectAvailabilityInfo } from '@onecore/types'
import currency from 'currency.js'
import { TenfastLease, TenfastRentalObject } from './schemas'
import { filterByStatus } from './filters'

// TODO: Säkerställ med expand att den här logiken håller för korttidskontrakt.
// Ev behöver vi kolla på någon till egenskap förutom endDate
export const getLatestActiveLeasesEndDate = (
  leases: TenfastLease[]
): Date | null => {
  if (leases.length === 0) return null
  const endDates = filterByStatus(leases, [
    'current',
    'about-to-end',
    'upcoming',
  ])
    .map((lease) => lease.endDate)
    .filter((date): date is Date => date != null)
    .sort((a, b) => b.getTime() - a.getTime()) // Sort descending to get the latest date first

  if (endDates.length === 0) return null

  return new Date(endDates[0]) // Return the latest end date
}

export const mapTenfastRentalObjectToAvailabilityInfo = (
  includeVAT: boolean,
  tenfastRentalObject: TenfastRentalObject
): RentalObjectAvailabilityInfo => {
  const lastDebitDate = getLatestActiveLeasesEndDate(
    tenfastRentalObject.avtal ?? []
  )

  let vacantFrom
  if (lastDebitDate) {
    //if there is a last debit date, vacantFrom should be the day after
    vacantFrom = new Date(lastDebitDate)
    vacantFrom.setUTCDate(vacantFrom.getUTCDate() + 1)
    vacantFrom.setUTCHours(0, 0, 0, 0) // Set to start of the day UTC
  } else {
    //there is no last debit date, the parking space is vacant as of today
    vacantFrom = new Date()
    vacantFrom.setUTCHours(0, 0, 0, 0) // Set to start of the day UTC
  }

  return {
    rentalObjectCode: tenfastRentalObject.externalId,
    vacantFrom: vacantFrom,
    rent: {
      amount: includeVAT
        ? tenfastRentalObject.hyra
        : tenfastRentalObject.hyraExcludingVat,
      vat: includeVAT ? tenfastRentalObject.hyraVat : 0,
      rows: tenfastRentalObject.hyror.map((hyra) => ({
        description: hyra.label || '',
        amount: includeVAT
          ? currency(hyra.amount).add(hyra.vat).value
          : hyra.amount,
        vatPercentage: includeVAT ? hyra.vat : 0,
        fromDate: hyra.from != undefined ? new Date(hyra.from) : undefined,
        toDate: hyra.to != undefined ? new Date(hyra.to) : undefined,
        code: hyra.article || '', //TODO:vad ska denna sättas till? Är article rätt fält?
      })),
    },
  }
}
