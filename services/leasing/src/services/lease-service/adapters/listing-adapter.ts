import { Applicant, Listing, ListingStatus } from 'onecore-types'

import knex from 'knex'
import Config from '../../../common/config'

//todo: handle case conversion, db schema is pascalcase but onecore-types is camelcase

const db = knex({
  client: 'mssql',
  connection: Config.leasingDatabase,
})

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

  return {
    id: insertedRow[0].Id,
    rentalObjectCode: insertedRow[0].RentalObjectCode,
    address:  insertedRow[0].Address,
    monthlyRent:  insertedRow[0].MonthlyRent,
    districtCaption:  insertedRow[0].DistrictCaption,
    districtCode:  insertedRow[0].DistrictCode,
    blockCaption:  insertedRow[0].BlockCaption,
    blockCode:  insertedRow[0].BlockCode,
    objectTypeCaption:  insertedRow[0].ObjectTypeCaption,
    objectTypeCode:  insertedRow[0].ObjectTypeCode,
    rentalObjectTypeCaption:  insertedRow[0].RentalObjectTypeCaption,
    rentalObjectTypeCode:  insertedRow[0].RentalObjectCode,
    publishedFrom:  insertedRow[0].PublishedFrom,
    publishedTo:  insertedRow[0].PublishedTo,
    vacantFrom:  insertedRow[0].VacantFrom,
    status:  insertedRow[0].Status,
    waitingListType:  insertedRow[0].WaitingListType
  }
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

  return  {
    id: listing.Id,
    rentalObjectCode: listing.RentalObjectCode,
    address: listing.Address,
    monthlyRent: listing.MonthlyRent,
    districtCaption: listing.DistrictCaption,
    districtCode: listing.DistrictCode,
    blockCaption: listing.BlockCaption,
    blockCode: listing.BlockCode,
    objectTypeCaption: listing.ObjectTypeCaption,
    objectTypeCode: listing.ObjectTypeCode,
    rentalObjectTypeCaption: listing.RentalObjectTypeCaption,
    rentalObjectTypeCode: listing.RentalObjectTypeCode,
    publishedFrom: listing.PublishedFrom,
    publishedTo: listing.PublishedTo,
    vacantFrom: listing.VacantFrom,
    status: listing.Status,
    waitingListType: listing.WaitingListType
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
    .where({ ContactCode: contactCode }).first();
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