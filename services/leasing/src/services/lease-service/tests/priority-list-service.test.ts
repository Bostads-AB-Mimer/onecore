import { Lease, LeaseStatus } from 'onecore-types'
import assert from 'node:assert'
import {
  addPriorityToApplicantsBasedOnRentalRules,
  assignPriorityToApplicantBasedOnRentalRules,
  isLeaseActiveOrUpcoming,
  parseLeasesForHousingContracts,
  parseLeasesForParkingSpaces,
  sortApplicantsBasedOnRentalRules,
} from '../priority-list-service'
import * as factory from './factories'
import { leaseTypes } from '../../../constants/leaseTypes'
import { addDays, parseISO } from 'date-fns'

//dynamic dates for active and upcoming contracts
const currentDate = new Date()
const thirtyDaysInThePastDate = addDays(currentDate, -30)
const thirtyDaysInTheFutureDate = addDays(currentDate, 30)

describe('parseLeasesForHousingContract', () => {
  it('should return 1 housing contract if only 1 active housing contract', async () => {
    const terminatedHousingContract = factory.lease
      .params({
        type: leaseTypes.housingContract,
        leaseStartDate: parseISO('2011-01-01T00:00:00.000Z'),
        noticeDate: parseISO('2019-09-04T00:00:00.000Z'),
        contractDate: parseISO('2010-12-28T00:00:00.000Z'),
        lastDebitDate: parseISO('2019-09-30T00:00:00.000Z'),
        approvalDate: parseISO('2010-12-28T00:00:00.000Z'),
        status: LeaseStatus.AboutToEnd,
      })
      .build()

    const activeHousingContract = factory.lease
      .params({
        type: leaseTypes.housingContract,
        leaseStartDate: parseISO('2019-10-01T00:00:00.000Z'),
        contractDate: parseISO('2019-09-04T00:00:00.000Z'),
        approvalDate: parseISO('2019-09-04T00:00:00.000Z'),
        status: LeaseStatus.Current,
      })
      .build()

    const activParkingSpaceContract = factory.lease
      .params({
        type: leaseTypes.parkingspaceContract,
        leaseStartDate: parseISO('2022-06-29T00:00:00.000Z'),
        contractDate: parseISO('2022-06-29T00:00:00.000Z'),
        approvalDate: parseISO('2022-06-29T00:00:00.000Z'),
        status: LeaseStatus.Current,
      })
      .build()

    const leases = [
      terminatedHousingContract,
      activeHousingContract,
      activParkingSpaceContract,
    ]

    const filteredLeases: Lease[] = leases.filter(isLeaseActiveOrUpcoming)

    expect(filteredLeases).toHaveLength(2)

    const result = parseLeasesForHousingContracts(filteredLeases)

    expect(result).toBeDefined()
    if (result) {
      expect(result[0]).toBeDefined()
      expect(result[1]).toBeUndefined()
    }
  })

  it('should return 1 upcoming housing contract and 1 current housing contract', async () => {
    const soonToBeTerminatedHousingContract = factory.lease
      .params({
        type: leaseTypes.housingContract,
        leaseStartDate: parseISO('2022-02-01T00:00:00.000Z'),
        noticeGivenBy: 'G',
        noticeDate: thirtyDaysInThePastDate,
        noticeTimeTenant: '3',
        preferredMoveOutDate: thirtyDaysInTheFutureDate,
        terminationDate: thirtyDaysInTheFutureDate,
        contractDate: parseISO('2021-09-08T00:00:00.000Z'),
        lastDebitDate: thirtyDaysInTheFutureDate,
        approvalDate: parseISO('2021-09-08T00:00:00.000Z'),
        status: LeaseStatus.Current,
      })
      .build()

    const upcomingHousingContract = factory.lease
      .params({
        type: leaseTypes.housingContract,
        leaseStartDate: thirtyDaysInTheFutureDate,
        contractDate: parseISO('2024-03-11T00:00:00.000Z'),
        approvalDate: parseISO('2024-03-11T00:00:00.000Z'),
        status: LeaseStatus.Upcoming,
      })
      .build()

    const parkingSpaceContract = factory.lease
      .params({
        type: leaseTypes.parkingspaceContract,
        leaseStartDate: parseISO('2022-02-01T00:00:00.000Z'),
        contractDate: parseISO('2021-12-02T00:00:00.000Z'),
        approvalDate: parseISO('2021-12-02T00:00:00.000Z'),
        status: LeaseStatus.Current,
      })
      .build()

    const leases = [
      soonToBeTerminatedHousingContract,
      upcomingHousingContract,
      parkingSpaceContract,
    ]

    const filteredLeases: Lease[] = leases.filter(isLeaseActiveOrUpcoming)
    const result = parseLeasesForHousingContracts(filteredLeases)

    expect(filteredLeases).toHaveLength(3)
    assert(result)

    expect(result[0]).toBeDefined()
    expect(result[1]).toBeDefined()
  })

  it('should return empty active housing contract and 1 upcoming housing contract', async () => {
    const upcomingHousingContract = factory.lease
      .params({
        type: leaseTypes.housingContract,
        leaseStartDate: thirtyDaysInTheFutureDate,
        contractDate: parseISO('2024-03-11T00:00:00.000Z'),
        approvalDate: parseISO('2024-03-11T00:00:00.000Z'),
        status: LeaseStatus.Upcoming,
      })
      .build()

    const leases = [upcomingHousingContract]

    const filteredLeases: Lease[] = leases.filter(isLeaseActiveOrUpcoming)
    const result = parseLeasesForHousingContracts(filteredLeases)

    expect(filteredLeases).toHaveLength(1)

    expect(result).toBeDefined()
    if (result) {
      expect(result[0]).toBeUndefined()
      expect(result[1]).toBeDefined()
    }
  })

  it('should return 1 housing contract out of 2 active contracts, the latest housing contract should be returned as active', async () => {
    const activeHousingContract = factory.lease
      .params({
        type: leaseTypes.housingContract,
        leaseStartDate: parseISO('2025-04-01T00:00:00.000Z'),
        contractDate: parseISO('2024-12-04T00:00:00.000Z'),
        approvalDate: parseISO('2024-12-04T00:00:00.000Z'),
        status: LeaseStatus.Current,
      })
      .build()

    const soonToBeTerminatedHousingContract = factory.lease
      .params({
        type: leaseTypes.housingContract,
        leaseStartDate: parseISO('2022-02-01T00:00:00.000Z'),
        noticeGivenBy: 'G',
        noticeDate: thirtyDaysInThePastDate,
        noticeTimeTenant: '3',
        preferredMoveOutDate: thirtyDaysInTheFutureDate,
        terminationDate: thirtyDaysInTheFutureDate,
        contractDate: parseISO('2021-09-08T00:00:00.000Z'),
        lastDebitDate: thirtyDaysInTheFutureDate,
        approvalDate: parseISO('2021-09-08T00:00:00.000Z'),
        status: LeaseStatus.Current,
      })
      .build()

    const leases = [soonToBeTerminatedHousingContract, activeHousingContract]

    const filteredLeases: Lease[] = leases.filter(isLeaseActiveOrUpcoming)
    const result = parseLeasesForHousingContracts(filteredLeases)

    expect(filteredLeases).toHaveLength(2)

    expect(result).toBeDefined()
    if (result) {
      expect(result[0]).toBeDefined()
      expect(result[0]?.leaseStartDate).toEqual(
        activeHousingContract.leaseStartDate
      )
      expect(result[1]).toBeUndefined()
    }
  })

  it('should return undefined for leases without housing contract', async () => {
    const result = parseLeasesForHousingContracts([])
    expect(result).toBeUndefined()
  })
})

describe('parseLeasesForParkingSpaces', () => {
  it('should return all parking spaces from leases', async () => {
    const housingContract = factory.lease
      .params({
        type: leaseTypes.housingContract,
        status: LeaseStatus.Current,
      })
      .build()

    const parkingSpacContract1 = factory.lease
      .params({
        type: leaseTypes.parkingspaceContract,
        status: LeaseStatus.Current,
      })
      .build()

    const parkingSpacContract2 = factory.lease
      .params({
        type: leaseTypes.parkingspaceContract,
        status: LeaseStatus.Current,
      })
      .build()

    const leases = [
      { ...housingContract, propertyType: 'foo' },
      { ...parkingSpacContract1, propertyType: 'babps' },
      { ...parkingSpacContract2, propertyType: 'babps' },
    ]

    const result = parseLeasesForParkingSpaces(leases)

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
    result?.forEach((lease) => {
      expect(lease.type).toEqual(leaseTypes.parkingspaceContract)
    })
  })

  it('should return empty list for leases without parking spaces', async () => {
    const result = parseLeasesForParkingSpaces([])
    expect(result).toEqual([])
  })
})

describe('assignPriorityToApplicantBasedOnRentalRules', () => {
  it('should throw error if applicant does not belong to the same listing', () => {
    const listing = factory.listing.build({ id: 1 })

    const applicant = factory.detailedApplicant.build({ listingId: 2 })

    expect(() =>
      assignPriorityToApplicantBasedOnRentalRules(listing, applicant)
    ).toThrow()
  })

  it('applicant should get priority 1 if no parking space contract and valid housing contract in same residential area as listing', async () => {
    const listing = factory.listing
      .params({
        districtCode: 'XYZ',
      })
      .build()

    const currentHousingContract = factory.lease
      .params({
        residentialArea: {
          code: 'XYZ',
        },
      })
      .build()

    const applicant = factory.detailedApplicant
      .params({
        currentHousingContract: currentHousingContract,
        listingId: listing.id,
      })
      .build()

    const result = assignPriorityToApplicantBasedOnRentalRules(
      listing,
      applicant
    )

    expect(result.priority).toBe(1)
  })

  it('applicant should get priority 1 if no parking space contract and upcoming housing contract in same residential area as listing', () => {
    const listing = factory.listing
      .params({
        districtCode: 'XYZ',
      })
      .build()

    const currentHousingContract = factory.lease
      .params({
        residentialArea: {
          code: 'ABC',
        },
        status: LeaseStatus.Upcoming,
      })
      .build()

    const upcomingHousingContract = factory.lease
      .params({
        residentialArea: {
          code: 'XYZ',
        },
      })
      .build()

    const applicant = factory.detailedApplicant
      .params({
        currentHousingContract: currentHousingContract,
        upcomingHousingContract: upcomingHousingContract,
        listingId: listing.id,
      })
      .build()

    const result = assignPriorityToApplicantBasedOnRentalRules(
      listing,
      applicant
    )

    expect(result.priority).toBe(1)
  })

  it('applicant should get priority 1 if has active parking space contract and applicationType equals Replace', () => {
    const listing = factory.listing.build()

    const parkingSpaceContract = factory.lease.build({
      status: LeaseStatus.Current,
    })

    const applicant = factory.detailedApplicant
      .params({
        applicationType: 'Replace', //todo: add as enum
        parkingSpaceContracts: [parkingSpaceContract],
        currentHousingContract: factory.lease.params({}).build(),
        listingId: listing.id,
      })
      .build()

    const result = assignPriorityToApplicantBasedOnRentalRules(
      listing,
      applicant
    )

    expect(result.priority).toBe(1)
  })

  it('applicant should get priority 1 if they only have parking space contracts that are about to end and valid housing contract in same residential area as listing', async () => {
    const listing = factory.listing
      .params({
        districtCode: 'XYZ',
      })
      .build()

    const currentHousingContract = factory.lease
      .params({
        residentialArea: {
          code: 'XYZ',
        },
      })
      .build()

    const parkingSpaceContract = factory.lease.build({
      status: LeaseStatus.AboutToEnd,
    })

    const applicant = factory.detailedApplicant
      .params({
        currentHousingContract: currentHousingContract,
        parkingSpaceContracts: [parkingSpaceContract],
        listingId: listing.id,
      })
      .build()

    const result = assignPriorityToApplicantBasedOnRentalRules(
      listing,
      applicant
    )

    expect(result.priority).toBe(1)
  })

  it('applicant should get priority 1 if they only have terminated parking spaces and valid housing contract in same residential area as listing', async () => {
    const listing = factory.listing
      .params({
        districtCode: 'XYZ',
      })
      .build()

    const currentHousingContract = factory.lease
      .params({
        residentialArea: {
          code: 'XYZ',
        },
      })
      .build()

    const parkingSpaceContract = factory.lease.build({
      status: LeaseStatus.Ended,
    })

    const applicant = factory.detailedApplicant
      .params({
        currentHousingContract: currentHousingContract,
        parkingSpaceContracts: [parkingSpaceContract],
        listingId: listing.id,
      })
      .build()

    const result = assignPriorityToApplicantBasedOnRentalRules(
      listing,
      applicant
    )

    expect(result.priority).toBe(1)
  })

  it('applicant should get priority 2 if has active parking space contract and applicationType equals Additional', () => {
    const listing = factory.listing.build()

    const parkingSpaceContract = factory.lease.build()

    const applicant = factory.detailedApplicant
      .params({
        applicationType: 'Additional', //todo: add as enum
        parkingSpaceContracts: [parkingSpaceContract],
        currentHousingContract: factory.lease.params({}).build(),
        listingId: listing.id,
      })
      .build()

    const result = assignPriorityToApplicantBasedOnRentalRules(
      listing,
      applicant
    )

    expect(result.priority).toBe(2)
  })

  it('applicant should get priority 2 if has more than 1 active parking space contracts and applicationType equals Replace', () => {
    const listing = factory.listing.build()

    const parkingSpaceContract1 = factory.lease.build()

    const parkingSpaceContract2 = factory.lease.build()

    const applicant = factory.detailedApplicant
      .params({
        applicationType: 'Replace', //todo: add as enum
        parkingSpaceContracts: [parkingSpaceContract1, parkingSpaceContract2],
        currentHousingContract: factory.lease.params({}).build(),
        listingId: listing.id,
      })
      .build()

    const result = assignPriorityToApplicantBasedOnRentalRules(
      listing,
      applicant
    )

    expect(result.priority).toBe(2)
  })

  it('applicant should get priority 3 if has more than 2 active parking space contracts applicationType equals Additional', () => {
    const listing = factory.listing.build()

    const parkingSpaceContract1 = factory.lease.build()

    const parkingSpaceContract2 = factory.lease.build()

    const parkingSpaceContract3 = factory.lease.build()

    const applicant = factory.detailedApplicant
      .params({
        applicationType: 'Additional', //todo: add as enum
        parkingSpaceContracts: [
          parkingSpaceContract1,
          parkingSpaceContract2,
          parkingSpaceContract3,
        ],
        currentHousingContract: factory.lease.build(),
        listingId: listing.id,
      })
      .build()

    const result = assignPriorityToApplicantBasedOnRentalRules(
      listing,
      applicant
    )

    expect(result.priority).toBe(3)
  })

  it('applicant should not get a priority if not eligible for renting in area with specific rental rule', () => {
    const listing = factory.listing
      .params({
        districtCode: 'CEN',
      })
      .build()

    const currentHousingContract = factory.lease
      .params({
        residentialArea: {
          code: 'XYZ',
        },
      })
      .build()

    const applicant = factory.detailedApplicant
      .params({
        currentHousingContract: currentHousingContract,
        listingId: listing.id,
      })
      .build()

    const result = assignPriorityToApplicantBasedOnRentalRules(
      listing,
      applicant
    )
    expect(result.priority).toBe(null)
  })
})

describe('sortApplicantsBasedOnRentalRules', () => {
  it('should sort applicants in expected order based on rental rules', () => {
    const listing = factory.listing
      .params({
        districtCode: 'XYZ',
      })
      .build()

    //priority 1 applicant
    //has no parking space contract and active housing contract in same residential area as listing
    const applicant1HousingContract = factory.lease
      .params({
        residentialArea: {
          code: 'XYZ',
        },
      })
      .build()

    const applicant1 = factory.detailedApplicant
      .params({
        currentHousingContract: applicant1HousingContract,
        listingId: listing.id,
        queuePoints: 10,
      })
      .build()

    //priority 1 applicant
    //no parking space contract and upcoming housing contract in same residential area as listing
    const applicant2CurrentHousingContract = factory.lease
      .params({
        residentialArea: {
          code: 'ABC',
        },
      })
      .build()

    const applicant2UpcomingHousingContract = factory.lease
      .params({
        residentialArea: {
          code: 'XYZ',
        },
      })
      .build()

    const applicant2 = factory.detailedApplicant
      .params({
        currentHousingContract: applicant2CurrentHousingContract,
        upcomingHousingContract: applicant2UpcomingHousingContract,
        listingId: listing.id,
        queuePoints: 20,
      })
      .build()

    //priority 1 applicant
    //active parking space contract and applicationType equals Replace
    const applicant3ParkingSpaceContract = factory.lease.build()

    const applicant3 = factory.detailedApplicant
      .params({
        applicationType: 'Replace', //todo: add as enum
        parkingSpaceContracts: [applicant3ParkingSpaceContract],
        currentHousingContract: factory.lease.build(),
        listingId: listing.id,
        queuePoints: 30,
      })
      .build()

    //priority 2 applicant
    //active parking space contract and applicationType equals Additional
    const applicant4ParkingSpaceContract = factory.lease.build()

    const applicant4 = factory.detailedApplicant
      .params({
        applicationType: 'Additional', //todo: add as enum
        parkingSpaceContracts: [applicant4ParkingSpaceContract],
        currentHousingContract: factory.lease.build(),
        listingId: listing.id,
        queuePoints: 40,
      })
      .build()

    //priority 2 applicant
    //more than 1 active parking space contracts and applicationType equals Replace
    const applicant5ParkingSpaceContract1 = factory.lease.build()
    const applicant5ParkingSpaceContract2 = factory.lease.build()

    const applicant5 = factory.detailedApplicant
      .params({
        applicationType: 'Replace', //todo: add as enum
        parkingSpaceContracts: [
          applicant5ParkingSpaceContract1,
          applicant5ParkingSpaceContract2,
        ],
        currentHousingContract: factory.lease.build(),
        listingId: listing.id,
        queuePoints: 50,
      })
      .build()

    //priority 3 applicant
    //has more than 2 active parking space contracts applicationType equals Additional
    const Applicant6parkingSpaceContract1 = factory.lease.build()
    const Applicant6parkingSpaceContract2 = factory.lease.build()
    const Applicant6parkingSpaceContract3 = factory.lease.build()

    const applicant6 = factory.detailedApplicant
      .params({
        applicationType: 'Additional', //todo: add as enum
        parkingSpaceContracts: [
          Applicant6parkingSpaceContract1,
          Applicant6parkingSpaceContract2,
          Applicant6parkingSpaceContract3,
        ],
        currentHousingContract: factory.lease.build(),
        listingId: listing.id,
        queuePoints: 60,
      })
      .build()

    const applicants = [
      applicant1,
      applicant2,
      applicant3,
      applicant4,
      applicant5,
      applicant6,
    ]

    const applicantsWithPriority = addPriorityToApplicantsBasedOnRentalRules(
      listing,
      applicants
    )
    expect(
      applicantsWithPriority.filter((applicant) => applicant.priority === 1)
    ).toHaveLength(3)
    expect(
      applicantsWithPriority.filter((applicant) => applicant.priority === 2)
    ).toHaveLength(2)
    expect(
      applicantsWithPriority.filter((applicant) => applicant.priority === 3)
    ).toHaveLength(1)

    const sortedApplicantsBasedOnRentalRules = sortApplicantsBasedOnRentalRules(
      applicantsWithPriority
    )

    expect(sortedApplicantsBasedOnRentalRules).toHaveLength(applicants.length)

    expect(sortedApplicantsBasedOnRentalRules[0].contactCode).toEqual(
      applicant3.contactCode
    ) //priority 1 and highest queuePoints
    expect(sortedApplicantsBasedOnRentalRules[1].contactCode).toEqual(
      applicant2.contactCode
    ) //priority 1 and second highest queuePoints
    expect(sortedApplicantsBasedOnRentalRules[2].contactCode).toEqual(
      applicant1.contactCode
    ) //priority 1 and third highest queuePoints
    expect(sortedApplicantsBasedOnRentalRules[3].contactCode).toEqual(
      applicant5.contactCode
    ) //priority 2 and fourth highest queuePoints
    expect(sortedApplicantsBasedOnRentalRules[4].contactCode).toEqual(
      applicant4.contactCode
    ) //priority 2 and fifth highest queuePoints
    expect(sortedApplicantsBasedOnRentalRules[5].contactCode).toEqual(
      applicant6.contactCode
    ) //priority 3 and lowest queuePoints
  })

  it('should handle priority 1 applicants with current and upcoming housing contracts', () => {
    const listing = factory.listing
      .params({
        districtCode: 'XYZ',
      })
      .build()

    //priority 1 applicant
    //has no parking space contract and active housing contract in same residential area as listing
    const applicant1HousingContract = factory.lease
      .params({
        residentialArea: {
          code: 'XYZ',
        },
      })
      .build()

    const applicant1 = factory.detailedApplicant
      .params({
        currentHousingContract: applicant1HousingContract,
        listingId: listing.id,
        queuePoints: 20,
      })
      .build()

    //priority 1 applicant
    //has no parking space contract and upcoming housing contract in same residential area as listing
    const applicant2UpcomingHousingContract = factory.lease
      .params({
        type: leaseTypes.housingContract,
        leaseStartDate: thirtyDaysInTheFutureDate,
        contractDate: new Date('2024-03-11T00:00:00.000Z'),
        approvalDate: new Date('2024-03-11T00:00:00.000Z'),
        status: LeaseStatus.Upcoming,
        residentialArea: {
          code: 'XYZ',
        },
      })
      .build()

    const applicant2 = factory.detailedApplicant
      .params({
        upcomingHousingContract: applicant2UpcomingHousingContract,
        listingId: listing.id,
        queuePoints: 10,
      })
      .build()

    const applicants = [applicant1, applicant2]

    const applicantsWithPriority = addPriorityToApplicantsBasedOnRentalRules(
      listing,
      applicants
    )
    expect(
      applicantsWithPriority.filter((applicant) => applicant.priority === 1)
    ).toHaveLength(2)

    const sortedApplicantsBasedOnRentalRules = sortApplicantsBasedOnRentalRules(
      applicantsWithPriority
    )

    expect(sortedApplicantsBasedOnRentalRules).toHaveLength(applicants.length)

    expect(sortedApplicantsBasedOnRentalRules[0].contactCode).toEqual(
      applicant1.contactCode
    )
    expect(sortedApplicantsBasedOnRentalRules[1].contactCode).toEqual(
      applicant2.contactCode
    )
  })

  it('should handle applicants with undefined priority', () => {
    const listing = factory.listing
      .params({
        districtCode: 'XYZ',
      })
      .build()

    //priority 1 applicant
    //has no parking space contract and active housing contract in same residential area as listing
    const applicant1HousingContract = factory.lease
      .params({
        residentialArea: {
          code: 'XYZ',
        },
      })
      .build()

    const applicant1 = factory.detailedApplicant
      .params({
        currentHousingContract: applicant1HousingContract,
        listingId: listing.id,
        queuePoints: 20,
      })
      .build()

    //priority undefined applicant
    //has no active or upcoming housing contract
    const applicant2 = factory.detailedApplicant
      .params({
        currentHousingContract: undefined,
        upcomingHousingContract: undefined,
        listingId: listing.id,
        queuePoints: 10,
      })
      .build()

    const applicants = [applicant1, applicant2]

    const applicantsWithPriority = addPriorityToApplicantsBasedOnRentalRules(
      listing,
      applicants
    )
    expect(
      applicantsWithPriority.filter((applicant) => applicant.priority === 1)
    ).toHaveLength(1)
    expect(
      applicantsWithPriority.filter((applicant) => applicant.priority === null)
    ).toHaveLength(1)

    const sortedApplicantsBasedOnRentalRules = sortApplicantsBasedOnRentalRules(
      applicantsWithPriority
    )

    expect(sortedApplicantsBasedOnRentalRules).toHaveLength(applicants.length)

    expect(sortedApplicantsBasedOnRentalRules[0].contactCode).toEqual(
      applicant1.contactCode
    )
    expect(sortedApplicantsBasedOnRentalRules[1].contactCode).toEqual(
      applicant2.contactCode
    )
  })

  it('should assign priority null if applicant has no upcoming housing contracts or active parking space contracts', () => {
    const listing = factory.listing.build({
      rentalObjectCode: '307-706-00-0015',
      districtCaption: 'Vallby',
      districtCode: 'VAL',
      objectTypeCaption: 'Parkeringsplats med el',
      objectTypeCode: 'PPLMEL',
      rentalObjectTypeCaption: 'Standard hyresobjektstyp',
      publishedFrom: new Date('2024-10-21T07:55:51.000Z'),
      publishedTo: new Date('2024-10-19T22:59:59.000Z'),
      vacantFrom: new Date('2022-04-30T22:00:00.000Z'),
      status: 4,
      waitingListType: 'Bilplats (intern)',
    })

    const detailedApplicant3 = factory.detailedApplicant
      .params({
        applicationDate: new Date('2024-11-07T14:44:40.610Z'),
        applicationType: 'Additional',
        status: 1,
        listingId: listing.id,
        currentHousingContract: {
          leaseId: '705-008-04-0101/04',
          leaseNumber: '04',
          rentalPropertyId: '705-008-04-0101',
          type: 'Bostadskontrakt               ',
          leaseStartDate: new Date('2013-03-01T00:00:00.000Z'),
          status: 0,
          noticeTimeTenant: '3',
          contractDate: new Date('2013-01-23T00:00:00.000Z'),
          approvalDate: new Date('2013-01-23T00:00:00.000Z'),
          residentialArea: {
            code: 'MAL',
            caption: 'Malmaberg',
          },
        },
        parkingSpaceContracts: [],
      })
      .build()

    const result3 = assignPriorityToApplicantBasedOnRentalRules(
      listing,
      detailedApplicant3
    )
    expect(result3.priority).toBe(null)
  })
})
