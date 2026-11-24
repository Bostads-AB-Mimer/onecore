import { Factory } from 'fishery'
import { LeaseStatus, LeaseType, leasing } from '@onecore/types'

type LeaseSearchResult = leasing.v1.LeaseSearchResult

export const LeaseSearchResultFactory = Factory.define<LeaseSearchResult>(
  ({ sequence }) => ({
    leaseId: `705-001-01-${String(sequence).padStart(4, '0')}/1`,
    objectTypeCode: 'Bostad',
    leaseType: LeaseType.HousingContract,
    contacts: [
      {
        contactCode: 'P158770',
        name: 'Test Testsson',
        email: null,
        phone: null,
        contactType: 'tenant',
      },
    ],
    address: 'Testgatan 1',
    postalCode: '72216',
    city: 'Västerås',
    startDate: new Date('2023-12-31T23:00:00Z'),
    endDate: null,
    lastDebitDate: null,
    signedAt: null,
    status: LeaseStatus.Current,
    rentalObjectCode: `705-001-01-${String(sequence).padStart(4, '0')}`,
  })
)
