import { Lease, Contact, Listing, Applicant } from 'onecore-types'

import knex from 'knex'
import Config from '../../../../common/config'

const db = knex({
  client: 'mssql',
  connection: Config.xpandDatabase,
})

type PartialLease = {
  leaseId: Lease['leaseId']
  leaseStartDate: Lease['leaseStartDate']
  lastDebitDate: Lease['lastDebitDate']
}

//todo: move all transformation code to separate file
const transformFromDbContact = (
  row: any,
  phoneNumbers: any,
  leases: any
): Contact => {
  const contact = {
    contactCode: row.contactCode,
    contactKey: row.contactKey,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    leaseIds: leases,
    nationalRegistrationNumber: row.nationalRegistrationNumber,
    birthDate: row.birthDate,
    address: {
      street: row.street,
      number: '',
      postalCode: row.postalCode,
      city: row.city,
    },
    phoneNumbers: phoneNumbers,
    emailAddress:
      process.env.NODE_ENV === 'prodution' ? row.emailAddress : 'redacted',
    isTenant: leases.length > 0,
  }

  return contact
}

const transformFromDbLease = (
  row: any,
  tenantContactIds: string[] | undefined,
  tenants: Contact[] | undefined
): Lease => {
  const parsedLeaseId = row.leaseId.split('/')
  const rentalPropertyId = parsedLeaseId[0]
  const leaseNumber = parsedLeaseId[1]

  const lease = {
    leaseId: row.leaseId,
    leaseNumber: leaseNumber,
    rentalPropertyId: rentalPropertyId,
    type: row.leaseType,
    leaseStartDate: row.fromDate,
    leaseEndDate: row.toDate,
    status: row.Status, //todo: support status
    tenantContactIds,
    tenants,
    rentalProperty: undefined,
    rentInfo: undefined,
    address: undefined,
    noticeGivenBy: row.noticeGivenBy,
    noticeDate: row.noticeDate,
    noticeTimeTenant: row.noticeTimeTenant,
    preferredMoveOutDate: row.preferredMoveOutDate,
    terminationDate: row.terminationDate,
    contractDate: row.contractDate,
    lastDebitDate: row.lastDebitDate,
    approvalDate: row.approvalDate,
  }

  return lease
}

//todo: include contact/tentant info
const getLease = async (leaseId: string): Promise<Lease | undefined> => {
  const rows = await getLeaseById(leaseId)
  if (rows.length > 0) {
    return transformFromDbLease(rows[0], [], [])
  }
  return undefined
}

const getLeases = async (leaseIds: string[] | undefined): Promise<Lease[]> => {
  const leases: Lease[] = []

  const rows = await db('Lease')
    .select(
      'hyobj.hyobjben as leaseId',
      'hyhav.hyhavben as leaseType',
      'hyobj.uppsagtav as noticeGivenBy',
      'hyobj.avtalsdat as contractDate',
      'hyobj.sistadeb as lastDebitDate',
      'hyobj.godkdatum as approvalDate',
      'hyobj.uppsdatum as noticeDate',
      'hyobj.fdate as fromDate',
      'hyobj.tdate as toDate',
      'hyobj.uppstidg as noticeTimeTenant',
      'hyobj.onskflytt AS preferredMoveOutDate',
      'hyobj.makuldatum AS terminationDate'
    )
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .innerJoin('hyhav', 'hyhav.keyhyhav', 'hyobj.keyhyhav')
    .modify((queryBuilder) => {
      if (leaseIds) {
        queryBuilder.whereIn('hyobjben', leaseIds)
      }
    })
    .limit(100)

  for (const row of rows) {
    const lease = await transformFromDbLease(row, [], [])
    leases.push(lease)
  }

  return leases
}

//todo: include contact/tentant info
const getLeasesForNationalRegistrationNumber = async (
  nationalRegistrationNumber: string,
  includeTerminatedLeases: string | string[] | undefined
) => {
  const contact = await db('cmctc')
    .select('cmctc.keycmctc as contactKey')
    .limit(1)
    .where({
      persorgnr: nationalRegistrationNumber,
    })
    .limit(1)

  if (contact != undefined) {
    const leases = await getLeasesByContactKey(contact[0].contactKey)

    if (shouldIncludeTerminatedLeases(includeTerminatedLeases)) {
      return leases
    }

    return leases.filter(isLeaseActive)
  }

  return undefined
}

const getLeasesForContactCode = async (
  contactCode: string,
  includeTerminatedLeases: string | string[] | undefined
) => {
  const contact = await db('cmctc')
    .select('cmctc.keycmctc as contactKey')
    .limit(1)
    .where({
      cmctckod: contactCode,
    })
    .limit(1)

  if (contact != undefined) {
    const leases = await getLeasesByContactKey(contact[0].contactKey)

    if (shouldIncludeTerminatedLeases(includeTerminatedLeases)) {
      return leases
    }

    return leases.filter(isLeaseActive)
  }
}

const getContactByNationalRegistrationNumber = async (
  nationalRegistrationNumber: string,
  includeTerminatedLeases: string | string[] | undefined
) => {
  const rows = await getContactQuery()
    .where({ persorgnr: nationalRegistrationNumber })
    .limit(1)
  if (rows && rows.length > 0) {
    const phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
    const leases = await getLeaseIds(
      rows[0].contactKey,
      includeTerminatedLeases
    )
    return transformFromDbContact(rows[0], phoneNumbers, leases)
  }

  return null
}

const getContactByContactCode = async (
  contactKey: string,
  includeTerminatedLeases: string | string[] | undefined
) => {
  const rows = await getContactQuery().where({ cmctckod: contactKey }).limit(1)
  if (rows && rows.length > 0) {
    const phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
    const leases = await getLeaseIds(
      rows[0].contactKey,
      includeTerminatedLeases
    )
    return transformFromDbContact(rows[0], phoneNumbers, leases)
  }

  return null
}

const getContactQuery = () => {
  return db('cmctc')
    .select(
      'cmctc.cmctckod as contactCode',
      'cmctc.fnamn as firstName',
      'cmctc.enamn as lastName',
      'cmctc.cmctcben as fullName',
      'cmctc.persorgnr as nationalRegistrationNumber',
      'cmctc.birthdate as birthDate',
      'cmadr.adress1 as street',
      'cmadr.adress3 as postalCode',
      'cmadr.adress4 as city',
      'cmeml.cmemlben as emailAddress',
      'cmobj.keycmobj as keycmobj',
      'cmctc.keycmctc as contactKey'
    )
    .innerJoin('cmobj', 'cmobj.keycmobj', 'cmctc.keycmobj')
    .innerJoin('cmadr', 'cmadr.keycode', 'cmobj.keycmobj')
    .innerJoin('cmeml', 'cmeml.keycmobj', 'cmobj.keycmobj')
}

const getPhoneNumbersForContact = async (keycmobj: string) => {
  const rows = await db('cmtel')
    .select(
      'cmtelben as phoneNumber',
      'keycmtet as type',
      'main as isMainNumber'
    )
    .where({ keycmobj: keycmobj })
  return rows
}

//todo: extend with type of lease? the type is found in hyhav.hyhavben
//todo: be able to filter on active contracts
const getLeaseIds = async (
  keycmctc: string,
  includeTerminatedLeases: string | string[] | undefined
) => {
  includeTerminatedLeases = Array.isArray(includeTerminatedLeases)
    ? includeTerminatedLeases[0]
    : includeTerminatedLeases
  const rows = await db('hyavk')
    .select(
      'hyobj.hyobjben as leaseId',
      'hyobj.fdate as leaseStartDate',
      'hyobj.sistadeb as lastDebitDate'
    )
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .where({ keycmctc: keycmctc })

  if (!includeTerminatedLeases || includeTerminatedLeases === 'false') {
    return rows.filter(isLeaseActive).map((x) => x.leaseId)
  }
  return rows.map((x) => x.leaseId)
}

const getLeasesByContactKey = async (keycmctc: string) => {
  const rows = await db('hyavk')
    .select(
      'hyobj.hyobjben as leaseId',
      'hyhav.hyhavben as leaseType',
      'hyobj.uppsagtav as noticeGivenBy',
      'hyobj.avtalsdat as contractDate',
      'hyobj.sistadeb as lastDebitDate',
      'hyobj.godkdatum as approvalDate',
      'hyobj.uppsdatum as noticeDate',
      'hyobj.fdate as fromDate',
      'hyobj.tdate as toDate',
      'hyobj.uppstidg as noticeTimeTenant',
      'hyobj.onskflytt AS preferredMoveOutDate',
      'hyobj.makuldatum AS terminationDate'
    )
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .innerJoin('hyhav', 'hyhav.keyhyhav', 'hyobj.keyhyhav')
    .where({ keycmctc: keycmctc })

  const leases: any[] = []
  for (const row of rows) {
    const lease = await transformFromDbLease(row, [], [])
    leases.push(lease)
  }

  return leases
}

const getLeaseById = async (hyobjben: string) => {
  const rows = await db('hyavk')
    .select(
      'hyobj.hyobjben as leaseId',
      'hyhav.hyhavben as leaseType',
      'hyobj.uppsagtav as noticeGivenBy',
      'hyobj.avtalsdat as contractDate',
      'hyobj.sistadeb as lastDebitDate',
      'hyobj.godkdatum as approvalDate',
      'hyobj.uppsdatum as noticeDate',
      'hyobj.fdate as fromDate',
      'hyobj.tdate as toDate',
      'hyobj.uppstidg as noticeTimeTenant',
      'hyobj.onskflytt AS preferredMoveOutDate',
      'hyobj.makuldatum AS terminationDate'
    )
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .innerJoin('hyhav', 'hyhav.keyhyhav', 'hyobj.keyhyhav')
    .where({ hyobjben: hyobjben })
  return rows
}

const shouldIncludeTerminatedLeases = (
  includeTerminatedLeases: string | string[] | undefined
) => {
  const queryParamResult = Array.isArray(includeTerminatedLeases)
    ? includeTerminatedLeases[0]
    : includeTerminatedLeases

  return !(!queryParamResult || queryParamResult === 'false')
}

const isLeaseActive = (lease: Lease | PartialLease): boolean => {
  const currentDate = new Date()
  const leaseStartDate = new Date(lease.leaseStartDate)
  const lastDebitDate = lease.lastDebitDate
    ? new Date(lease.lastDebitDate)
    : null

  return (
    leaseStartDate < currentDate &&
    (!lastDebitDate || currentDate < lastDebitDate)
  )
}

const createListing = async (listingData: Listing) => {
  await db('Listing').insert({
    RentalObjectCode: listingData.rentalObjectCode,
    Address: listingData.address,
    DistrictCaption: listingData.districtCaption,
    DistrictCode: listingData.districtCode,
    BlockCaption: listingData.blockCaption,
    BlockCode: listingData.blockCode,
    MonthlyRent: listingData.monthlyRent,
    ObjectTypeCaption: listingData.objectTypeCaption,
    ObjectTypeCode: listingData.objectTypeCode,
    RentalObjectTypeCaption: listingData.rentalObjectTypeCaption,
    RentalObjectTypeCode: listingData.rentalObjectTypeCode,
    PublishedFrom: listingData.publishedFrom,
    PublishedTo: listingData.publishedTo,
    VacantFrom: listingData.vacantFrom,
    Status: listingData.status,
    WaitingListType: listingData.waitingListType,
  });
}

/**
 * Checks if a listing already exists based on unique criteria.
 * 
 * @param {string} rentalObjectCode - The rental object code of the listing (originally from xpand)
 * @returns {Promise<Listing>} - Promise that resolves to the existing listing if it exists.
 */
const getListingByRentalObjectCode = async (rentalObjectCode: string): Promise<Listing> => {
  const existingListing = await db('Listing')
    .where({
      RentalObjectCode: rentalObjectCode
    })
    .first();

  return existingListing;
};

const createApplication = async (applicationData: Applicant) => {
  console.log(applicationData);
  await db('applicant').insert({
    Name: applicationData.name,
    ContactCode: applicationData.contactCode,
    ApplicationDate: applicationData.applicationDate,
    ApplicationType: applicationData.applicationType,
    Status: applicationData.status,
    ListingId: applicationData.listingId,
  });
}

const getAllListingsWithApplicants = async () => {
  const listings = await db('Listing').select('*');

  for (let listing of listings) {
    const applicants = await db('Applicant')
      .where('listingId', listing.Id)
      .select('*');

    listing.applicants = applicants;
  }

  return listings;
};

const getApplicantsByContactCode = async (contactCode: string) => {
  return db('Applicant')
    .where({ ContactCode: contactCode });
}

const getApplicantsByContactCodeAndRentalObjectCode = async (contactCode: string, rentalObjectCode: string) => {
  return db('Applicant')
    .where({
      ContactCode: contactCode,
      RentalObjectCode: rentalObjectCode
    })
    .first();
}

const applicationExists = async (contactCode: string, listingId: number) => {
  const result = await db('applicant')
    .where({
      ContactCode: contactCode,
      ListingId: listingId
    })
    .first();
  return !!result; // Convert result to boolean: true if exists, false if not
};



export {
  getLease,
  getLeases,
  getLeasesForContactCode,
  getLeasesForNationalRegistrationNumber,
  getContactByNationalRegistrationNumber,
  getContactByContactCode,
  isLeaseActive,
  createListing,
  createApplication,
  getListingByRentalObjectCode,
  getAllListingsWithApplicants,
  getApplicantsByContactCode,
  getApplicantsByContactCodeAndRentalObjectCode
}
