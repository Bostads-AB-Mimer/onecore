import {
  Applicant,
  Contact,
  Lease,
  LeaseStatus,
  WaitingList,
} from 'onecore-types'
import {
  getDetailedApplicantInformation,
  isLeaseActiveOrUpcoming,
  parseLeasesForHousingContracts,
  parseLeasesForParkingSpaces,
  parseWaitingListForInternalParkingSpace,
} from '../priority-list-service'
import * as tenantLeaseAdapter from '../adapters/xpand/tenant-lease-adapter'
import * as xpandSoapAdapter from '../adapters/xpand/xpand-soap-adapter'

const mockedApplicant: Applicant = {
  id: 2004,
  nationalRegistrationNumber: '197001011234',
  name: 'Sökande Fiktiv',
  contactCode: 'P145241',
  applicationDate: new Date('2024-04-23T10:05:07.244Z'),
  status: 1,
  listingId: 2029,
}

const mockedWaitingListWithInteralParkingSpace: WaitingList[] = [
  {
    applicantCaption: 'Foo Bar',
    contactCode: 'P12345',
    contractFromApartment: new Date('2024-02-29T23:00:00.000Z'),
    queuePoints: 45,
    queuePointsSocialConnection: 0,
    waitingListFrom: new Date('2024-01-31T23:00:00.000Z'),
    waitingListTypeCaption: 'Bostad',
  },
  {
    applicantCaption: 'Foo Bar',
    contactCode: 'P12345',
    contractFromApartment: new Date('2024-02-29T23:00:00.000Z'),
    queuePoints: 45,
    queuePointsSocialConnection: 0,
    waitingListFrom: new Date('2024-01-31T23:00:00.000Z'),
    waitingListTypeCaption: 'Bilplats (intern)',
  },
]

const mockedWaitingListWithoutInternalParkingSpace: WaitingList[] = [
  {
    applicantCaption: 'Foo Bar',
    contactCode: 'P12345',
    contractFromApartment: new Date('2024-02-29T23:00:00.000Z'),
    queuePoints: 45,
    queuePointsSocialConnection: 0,
    waitingListFrom: new Date('2024-01-31T23:00:00.000Z'),
    waitingListTypeCaption: 'Bostad',
  },
]

const mockedLeasesWithHousingAndParkingSpaceContracts: Lease[] = [
  //Bostadskontrakt
  {
    leaseId: '705-022-04-0201/11',
    leaseNumber: '11',
    rentalPropertyId: '705-022-04-0201',
    rentalProperty: undefined,
    type: 'Bostadskontrakt',
    leaseStartDate: new Date('2024-03-01T00:00:00.000Z'),
    leaseEndDate: undefined,
    tenantContactIds: [],
    tenants: [],
    noticeGivenBy: undefined,
    noticeDate: undefined,
    noticeTimeTenant: '3',
    preferredMoveOutDate: undefined,
    terminationDate: undefined,
    contractDate: new Date('2024-02-01T00:00:00.000Z'),
    lastDebitDate: undefined,
    approvalDate: new Date('2024-02-01T00:00:00.000Z'),
    status: LeaseStatus.Active,
    rentInfo: undefined,
    address: undefined,
  },
  //P-Platskontrakt
  {
    leaseId: '508-713-00-0009/19',
    leaseNumber: '19',
    rentalPropertyId: '508-713-00-0009',
    rentalProperty: undefined,
    type: 'P-Platskontrakt',
    leaseStartDate: new Date('2024-03-01T00:00:00.000Z'),
    leaseEndDate: undefined,
    tenantContactIds: [],
    tenants: [],
    noticeGivenBy: undefined,
    noticeDate: undefined,
    noticeTimeTenant: '3',
    preferredMoveOutDate: undefined,
    terminationDate: undefined,
    contractDate: new Date('2024-02-01T00:00:00.000Z'),
    lastDebitDate: undefined,
    approvalDate: new Date('2024-02-01T00:00:00.000Z'),
    status: LeaseStatus.Active,
    rentInfo: undefined,
    address: undefined,
  },
  //P-Platskontrakt
  {
    leaseId: '216-704-00-0017/02',
    leaseNumber: '02',
    rentalPropertyId: '216-704-00-0017',
    rentalProperty: undefined,
    type: 'P-Platskontrakt',
    leaseStartDate: new Date('2024-04-02T00:00:00.000Z'),
    leaseEndDate: undefined,
    tenantContactIds: [],
    tenants: [],
    noticeGivenBy: '',
    noticeDate: new Date(),
    noticeTimeTenant: '3',
    preferredMoveOutDate: new Date(),
    terminationDate: new Date(),
    contractDate: new Date(),
    lastDebitDate: new Date(),
    approvalDate: new Date(),
    status: LeaseStatus.Active,
    rentInfo: undefined,
    address: undefined,
  },
]

//dynamic dates for active and upcoming contracts
const currentDate = new Date()
const thirtyDaysInThePastDate = new Date()
const thirtyDaysInTheFutureDate = new Date()
thirtyDaysInThePastDate.setDate(currentDate.getDate() + 30)
thirtyDaysInTheFutureDate.setDate(currentDate.getDate() + 30)

const mockedLeasesWithUpcomingHousingContract: Lease[] = [
  //still active but soon to be terminated housing contract
  {
    leaseId: '605-004-01-0103/01T',
    leaseNumber: '01T',
    rentalPropertyId: '605-004-01-0103',
    rentalProperty: undefined,
    type: 'Bostadskontrakt               ',
    leaseStartDate: new Date('2022-02-01T00:00:00.000Z'),
    leaseEndDate: undefined,
    tenantContactIds: [],
    tenants: [],
    noticeGivenBy: 'G',
    noticeDate: thirtyDaysInThePastDate, //new Date('2024-03-11T00:00:00.000Z'),
    noticeTimeTenant: '3',
    preferredMoveOutDate: thirtyDaysInTheFutureDate, //new Date('2024-04-30T00:00:00.000Z'),
    terminationDate: thirtyDaysInTheFutureDate,
    contractDate: new Date('2021-09-08T00:00:00.000Z'),
    lastDebitDate: thirtyDaysInTheFutureDate, //new Date('2024-06-30T00:00:00.000Z'),
    approvalDate: new Date('2021-09-08T00:00:00.000Z'),
    status: LeaseStatus.Active,
    rentInfo: undefined,
    address: undefined,
  },
  //upcoming housing contract to replace current active contract
  {
    leaseId: '605-004-01-0103/01',
    leaseNumber: '01',
    rentalPropertyId: '605-004-01-0103',
    rentalProperty: undefined,
    type: 'Bostadskontrakt               ',
    leaseStartDate: thirtyDaysInTheFutureDate, //new Date('2024-07-01T00:00:00.000Z'),
    leaseEndDate: undefined,
    tenantContactIds: [],
    tenants: [],
    noticeGivenBy: undefined,
    noticeDate: undefined,
    noticeTimeTenant: '3',
    preferredMoveOutDate: undefined,
    terminationDate: undefined,
    contractDate: new Date('2024-03-11T00:00:00.000Z'),
    lastDebitDate: undefined,
    approvalDate: new Date('2024-03-11T00:00:00.000Z'),
    status: LeaseStatus.Upcoming,
    rentInfo: undefined,
    address: undefined,
  },
  //parking space contract
  {
    leaseId: '605-703-00-0014/01',
    leaseNumber: '01',
    rentalPropertyId: '605-703-00-0014',
    rentalProperty: undefined,
    type: 'P-Platskontrakt               ',
    leaseStartDate: new Date('2022-02-01T00:00:00.000Z'),
    leaseEndDate: undefined,
    tenantContactIds: [],
    tenants: [],
    noticeGivenBy: undefined,
    noticeDate: undefined,
    noticeTimeTenant: '3',
    preferredMoveOutDate: undefined,
    terminationDate: undefined,
    contractDate: new Date('2021-12-02T00:00:00.000Z'),
    lastDebitDate: undefined,
    approvalDate: new Date('2021-12-02T00:00:00.000Z'),
    status: LeaseStatus.Active,
    rentInfo: undefined,
    address: undefined,
  },
]

// 1 active housing contract, 1 upcoming housing contract, 1 active parkingspace
const mockedLeasesWithOneActiveHousingContractAndOneTerminatedHousingContract: Lease[] =
  [
    //old and terminated housing contract
    {
      leaseId: '704-003-02-0302/02',
      leaseNumber: '02',
      rentalPropertyId: '704-003-02-0302',
      rentalProperty: undefined,
      type: 'Bostadskontrakt               ',
      leaseStartDate: new Date('2011-01-01T00:00:00.000Z'),
      leaseEndDate: undefined,
      tenantContactIds: [],
      tenants: [],
      noticeGivenBy: 'G',
      noticeDate: new Date('2019-09-04T00:00:00.000Z'),
      noticeTimeTenant: '3',
      preferredMoveOutDate: new Date('2019-09-30T00:00:00.000Z'),
      terminationDate: undefined,
      contractDate: new Date('2010-12-28T00:00:00.000Z'),
      lastDebitDate: new Date('2019-09-30T00:00:00.000Z'),
      approvalDate: new Date('2010-12-28T00:00:00.000Z'),
      status: LeaseStatus.Upcoming,
      rentInfo: undefined,
      address: undefined,
    },
    //active housing contract
    {
      leaseId: '104-061-02-0202/11',
      leaseNumber: '11',
      rentalPropertyId: '104-061-02-0202',
      rentalProperty: undefined,
      type: 'Bostadskontrakt               ',
      leaseStartDate: new Date('2019-10-01T00:00:00.000Z'),
      leaseEndDate: undefined,
      tenantContactIds: [],
      tenants: [],
      noticeGivenBy: undefined,
      noticeDate: undefined,
      noticeTimeTenant: '3',
      preferredMoveOutDate: undefined,
      terminationDate: undefined,
      contractDate: new Date('2019-09-04T00:00:00.000Z'),
      lastDebitDate: undefined,
      approvalDate: new Date('2019-09-04T00:00:00.000Z'),
      status: LeaseStatus.Active,
      rentInfo: undefined,
      address: undefined,
    },
    //active parking space contract
    {
      leaseId: '104-071-99-0049/19',
      leaseNumber: '19',
      rentalPropertyId: '104-071-99-0049',
      rentalProperty: undefined,
      type: 'Garagekontrakt                ',
      leaseStartDate: new Date('2022-06-29T00:00:00.000Z'),
      leaseEndDate: undefined,
      tenantContactIds: [],
      tenants: [],
      noticeGivenBy: undefined,
      noticeDate: undefined,
      noticeTimeTenant: '3',
      preferredMoveOutDate: undefined,
      terminationDate: undefined,
      contractDate: new Date('2022-06-29T00:00:00.000Z'),
      lastDebitDate: undefined,
      approvalDate: new Date('2022-06-29T00:00:00.000Z'),
      status: LeaseStatus.Active,
      rentInfo: undefined,
      address: undefined,
    },
  ]

const mockedApplicantFromXpand: Contact = {
  contactCode: 'P145241',
  contactKey: '_5YI0VPRJ5GARYV',
  firstName: 'Fiktiv',
  lastName: 'Sökande',
  fullName: 'Sökande Fiktiv',
  leaseIds: [
    '000-000-00-0001/03M2',
    '209-004-02-0201/12M',
    '105-001-17-0102/03M2',
    '105-002-07-0202/10M2',
    '306-001-01-0101/07',
  ],
  nationalRegistrationNumber: '198912157982',
  birthDate: new Date('1989-12-15T00:00:00.000Z'),
  address: {
    number: '',
    street: 'Fiktiggatan 1',
    postalCode: '72222',
    city: 'VÄSTERÅS',
  },
  phoneNumbers: [
    {
      phoneNumber: '0704657064',
      type: 'mobil',
      isMainNumber: true,
    },
    {
      phoneNumber: '021-13333                     ',
      type: 'telarbete      ',
      isMainNumber: false,
    },
  ],
  emailAddress: 'redacted',
  isTenant: true,
}

describe('getDetailedApplicantInformation', () => {
  it('should throw error if applicant not found from contact query', async () => {
    const getContactByContactCodeSpy = jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValue(null)

    await expect(() =>
      getDetailedApplicantInformation(mockedApplicant)
    ).rejects.toThrow(
      `Applicant ${mockedApplicant.contactCode} not found in contact query`
    )

    expect(getContactByContactCodeSpy).toHaveBeenCalled()
  })

  it('should throw error if waiting list not found for applicant', async () => {
    const tenantLeaseAdapterSpy = jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValue(mockedApplicantFromXpand)

    const getWaitingListSpy = jest
      .spyOn(xpandSoapAdapter, 'getWaitingList')
      .mockResolvedValue([])

    await expect(() =>
      getDetailedApplicantInformation(mockedApplicant)
    ).rejects.toThrow(
      `Waiting list for internal parking space not found for applicant ${mockedApplicant.contactCode}`
    )

    expect(tenantLeaseAdapterSpy).toHaveBeenCalled()
    expect(getWaitingListSpy).toHaveBeenCalled()
  })

  it('should throw error if leases not found for applicant', async () => {
    const getContactByContactCodeSpy = jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValue(mockedApplicantFromXpand)

    const getWaitingListSpy = jest
      .spyOn(xpandSoapAdapter, 'getWaitingList')
      .mockResolvedValue(mockedWaitingListWithInteralParkingSpace)

    const getLeasesForContactCodeSpy = jest
      .spyOn(tenantLeaseAdapter, 'getLeasesForContactCode')
      .mockResolvedValue(undefined)

    await expect(() =>
      getDetailedApplicantInformation(mockedApplicant)
    ).rejects.toThrow(
      `Leases not found for applicant ${mockedApplicant.contactCode}`
    )

    expect(getContactByContactCodeSpy).toHaveBeenCalled()
    expect(getWaitingListSpy).toHaveBeenCalled()
    expect(getLeasesForContactCodeSpy).toHaveBeenCalled()
  })

  it('should return applicant with expected data on success', async () => {
    //todo: write test when return type interface is defined
  })
})

describe('parseWaitingList', () => {
  it('should return waitingList for internal parking space', async () => {
    const result = parseWaitingListForInternalParkingSpace(
      mockedWaitingListWithInteralParkingSpace
    )

    expect(result).toBeDefined()
    expect(result).toEqual(mockedWaitingListWithInteralParkingSpace[1])
  })

  it('should return undefined for waitingList without internal parking space', async () => {
    const result = parseWaitingListForInternalParkingSpace(
      mockedWaitingListWithoutInternalParkingSpace
    )
    expect(result).toBeUndefined()
  })
})

describe('parseLeasesForHousingContract', () => {
  it('should return 1 housing contract if only 1 active housing contract', async () => {
    const filteredLeases: Lease[] =
      mockedLeasesWithOneActiveHousingContractAndOneTerminatedHousingContract.filter(
        isLeaseActiveOrUpcoming
      )

    expect(filteredLeases).toHaveLength(2)

    const result = parseLeasesForHousingContracts(filteredLeases)

    expect(result).toBeDefined()
    if (result) {
      expect(result[0]).toBeDefined()
      expect(result[1]).toBeUndefined()
    }
  })

  it('should return 1 active housing contract and 1 upcoming housing contract', async () => {
    const filteredLeases: Lease[] =
      mockedLeasesWithUpcomingHousingContract.filter(isLeaseActiveOrUpcoming)
    const result = parseLeasesForHousingContracts(filteredLeases)

    expect(filteredLeases).toHaveLength(3)

    expect(result).toBeDefined()
    if (result) {
      expect(result[0]).toBeDefined()
      expect(result[1]).toBeDefined()
    }
  })

  it('should return undefined for leases without housing contract', async () => {
    const result = parseLeasesForHousingContracts([])
    expect(result).toBeUndefined()
  })
})

describe('parseLeasesForParkingSpaces', () => {
  it('should return all parking spaces from leases', async () => {
    const result = parseLeasesForParkingSpaces(
      mockedLeasesWithHousingAndParkingSpaceContracts
    )

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
    result?.forEach((lease) => {
      expect(lease.type).toEqual('P-Platskontrakt')
    })
  })

  it('should return empty list for leases without parking spaces', async () => {
    const result = parseLeasesForParkingSpaces([])
    expect(result).toEqual([])
  })
})
