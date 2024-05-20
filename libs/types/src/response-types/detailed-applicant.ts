import { Address, Applicant, Lease } from '../types'

//dependent services: onecore-leasing, onecore-core, onecore-internal-portal
//external dependencies: xpand-database, xpand-soap-service
interface DetailedApplicant extends Applicant {
  queuePoints: number
  address?: Address
  currentHousingContract?: Lease
  upcomingHousingContract?: Lease
  parkingSpaceContracts?: Lease[]
  priority?: number
}

export type {
  DetailedApplicant,
}