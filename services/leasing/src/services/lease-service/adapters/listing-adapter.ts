import {
  Applicant,
  Invoice,
  Listing,
  ListingStatus,
  ParkingSpaceApplicationCategory,
  parkingSpaceApplicationCategoryTranslation,
} from 'onecore-types'

import knex from 'knex'
import Config from '../../../common/config'

const db = knex({
  client: 'mssql',
  connection: Config.leasingDatabase,
})

function transformFromDbListing(row: any): Listing {
  return {
    id: row.Id,
    rentalObjectCode: row.RentalObjectCode,
    address: row.Address,
    monthlyRent: row.MonthlyRent,
    districtCaption: row.DistrictCaption,
    districtCode: row.DistrictCode,
    blockCaption: row.BlockCaption,
    blockCode: row.BlockCode,
    objectTypeCaption: row.ObjectTypeCaption,
    objectTypeCode: row.ObjectTypeCode,
    rentalObjectTypeCaption: row.RentalObjectTypeCaption,
    rentalObjectTypeCode: row.RentalObjectTypeCode,
    publishedFrom: row.PublishedFrom,
    publishedTo: row.PublishedTo,
    vacantFrom: row.VacantFrom,
    status: row.Status,
    waitingListType: row.WaitingListType,
  }
}

function transformDbApplicant(row: any): Applicant {
  return {
    id: row.Id,
    name: row.Name,
    contactCode: row.ContactCode,
    applicationDate: row.ApplicationDate,
    status: row.Status,
    listingId: row.ListingId,
  }
}

const createListing = async (listingData: Listing) => {
  const insertedRow = await db('Listing')
    .insert({
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
    })
    .returning('*');

  return transformFromDbListing(insertedRow[0])
}

/**
 * Checks if a listing already exists based on unique criteria.
 *
 * @param {string} rentalObjectCode - The rental object code of the listing (originally from xpand)
 * @returns {Promise<Listing>} - Promise that resolves to the existing listing if it exists.
 */
const getListingByRentalObjectCode = async (rentalObjectCode: string): Promise<Listing | undefined> => {
  const listing = await db('Listing')
    .where({
      RentalObjectCode: rentalObjectCode
    })
    .first();

  if(listing == undefined){
    return undefined
  }
  return transformFromDbListing(listing)
};

const createApplication = async (applicationData: Applicant) => {
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
  const dbListings: Listing[] = await db('Listing').select('*');
  let transformedListings: Listing[]  = []

  for (const listing of dbListings) {
    let transformedListing = transformFromDbListing(listing)
    transformedListings.push(transformedListing)
  }

  for (const listing of transformedListings) {
    const dbApplicants = await db('Applicant')
      .where('ListingId', listing.id)
      .select('*');

    let transformedApplicants: Applicant[] = []
    for(const applicant of dbApplicants){
      transformedApplicants.push(transformDbApplicant(applicant))
    }
    listing.applicants = transformedApplicants
  }

  return transformedListings;
};

const getApplicantsByContactCode = async (contactCode: string) => {
  const result =  await db('Applicant')
    .where({ ContactCode: contactCode }).first();

  if(result == undefined)
    return undefined

  return transformDbApplicant(result)
}

const getApplicantsByContactCodeAndRentalObjectCode = async (contactCode: string, rentalObjectCode: string) => {
  const result = await db('Applicant')
    .where({
      ContactCode: contactCode,
      RentalObjectCode: rentalObjectCode
    })
    .first();

  if(result == undefined)
    return undefined

  return transformDbApplicant(result)
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
  createListing,
  createApplication,
  getListingByRentalObjectCode,
  getAllListingsWithApplicants,
  getApplicantsByContactCode,
  getApplicantsByContactCodeAndRentalObjectCode,
  applicationExists
}