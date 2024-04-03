import { Applicant, Listing } from 'onecore-types'

import knex from 'knex'
import Config from '../../../common/config'

console.log("config: ")
console.log(Config)

const db = knex({
  client: 'mssql',
  connection: Config.leasingDatabase,
})

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

  return  {
    id: existingListing.Id,
    rentalObjectCode: existingListing.RentalObjectCode,
    address: existingListing.Address,
    monthlyRent: existingListing.MonthlyRent,
    districtCaption: existingListing.DistrictCaption,
    districtCode: existingListing.DistrictCode,
    blockCaption: existingListing.BlockCaption,
    blockCode: existingListing.BlockCode,
    objectTypeCaption: existingListing.ObjectTypeCaption,
    objectTypeCode: existingListing.ObjectTypeCode,
    rentalObjectTypeCaption: existingListing.RentalObjectTypeCaption,
    rentalObjectTypeCode: existingListing.RentalObjectTypeCode,
    publishedFrom: existingListing.PublishedFrom,
    publishedTo: existingListing.PublishedTo,
    vacantFrom: existingListing.VacantFrom,
    status: existingListing.Status,
    waitingListType: existingListing.WaitingListType
  };
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

export {
  createListing,
  createApplication,
  getListingByRentalObjectCode,
  getAllListingsWithApplicants,
  getApplicantsByContactCode,
  getApplicantsByContactCodeAndRentalObjectCode
}