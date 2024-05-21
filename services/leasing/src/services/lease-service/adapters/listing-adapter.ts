import { Applicant, Listing, ApplicantStatus } from 'onecore-types'
import { db } from './db'

function transformFromDbListing(row: any): Listing {
  // TODO: Listing has some properties T | undefined.
  // However, this function is returning null when the db returns null
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
    applicants: undefined,
  }
}

function transformDbApplicant(row: any): Applicant {
  return {
    id: row.Id,
    name: row.Name,
    nationalRegistrationNumber: row.NationalRegistrationNumber,
    contactCode: row.ContactCode,
    applicationDate: row.ApplicationDate,
    applicationType: row.ApplicationType,
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
    .returning('*')

  return transformFromDbListing(insertedRow[0])
}

/**
 * Checks if a listing already exists based on unique criteria.
 *
 * @param {string} rentalObjectCode - The rental object code of the listing (originally from xpand)
 * @returns {Promise<Listing>} - Promise that resolves to the existing listing if it exists.
 */
const getListingByRentalObjectCode = async (
  rentalObjectCode: string
): Promise<Listing | undefined> => {
  const listing = await db('Listing')
    .where({
      RentalObjectCode: rentalObjectCode,
    })
    .first()

  if (listing == undefined) {
    return undefined
  }
  return transformFromDbListing(listing)
}

/**
 * Checks if a listing already exists based on unique criteria.
 *
 * @param {string} listingId - The rental object code of the listing (originally from xpand).
 * @returns {Promise<Listing>} - Promise that resolves to the existing listing if it exists.
 */
const getListingById = async (
  listingId: string
): Promise<Listing | undefined> => {
  const result = await db
    .from('listing AS l')
    .select(
      'l.*',
      db.raw(`
      (
        SELECT a.*
        FROM applicant a
        WHERE a.ListingId = l.Id
        FOR JSON PATH
      ) as applicants
    `)
    )
    .where('l.Id', listingId)
    .first()

  const parseApplicantsJson = (row: { applicants?: string }) => ({
    ...row,
    applicants: row.applicants ? JSON.parse(row.applicants) : [],
  })

  const transformListing = (row: { applicants: Array<unknown> }): Listing => ({
    ...transformFromDbListing(row),
    applicants: row.applicants.map(transformDbApplicant),
  })

  if (!result) return undefined

  return transformListing(parseApplicantsJson(result))
}

/**
 * Gets an applicant by id
 *
 * @param {number} applicantId - The ID of the applicant.
 * @returns {Promise<Applicant | undefined>} - Returns the applicant.
 */
const getApplicantById = async (
  applicantId: number
): Promise<Applicant | undefined> => {
  const applicant = await db('Applicant')
    .where({
      Id: applicantId,
    })
    .first()

  if (applicant == undefined) {
    return undefined
  }
  return transformDbApplicant(applicant)
}

const createApplication = async (applicationData: Applicant) => {
  await db('applicant').insert({
    Name: applicationData.name,
    NationalRegistrationNumber: applicationData.nationalRegistrationNumber,
    ContactCode: applicationData.contactCode,
    ApplicationDate: applicationData.applicationDate,
    ApplicationType: applicationData.applicationType,
    Status: applicationData.status,
    ListingId: applicationData.listingId,
  })
}

/**
 * Updates the status of an existing applicant using the ApplicantStatus enum.
 *
 * @param {number} applicantId - The ID of the applicant to update.
 * @param {ApplicantStatus} status - The new status to set for the applicant.
 * @returns {Promise<boolean>} - Returns true if the update was successful, false otherwise.
 */
const updateApplicantStatus = async (
  applicantId: number,
  status: ApplicantStatus
) => {
  try {
    const updateCount = await db('applicant').where('Id', applicantId).update({
      Status: status,
    })

    return updateCount > 0
  } catch (error) {
    console.error('Error updating applicant status:', error)
    throw error
  }
}

/**
 * Gets all listings with applicants
 *
 * @returns {Promise<Listing[]>} - Returns a list of listings.
 */
const getAllListingsWithApplicants = async () => {
  const query = `
    SELECT
      l.*,
      (
        SELECT a.*
        FROM applicant a
        WHERE a.ListingId = l.Id
        FOR JSON PATH
      ) as applicants
    FROM listing l
  `

  const parseApplicantsJson = (row: { applicants?: string }) => ({
    ...row,
    applicants: row.applicants ? JSON.parse(row.applicants) : [],
  })

  const transformListing = (row: { applicants: Array<unknown> }) => ({
    ...transformFromDbListing(row),
    applicants: row.applicants.map(transformDbApplicant),
  })

  const result: Array<Listing> = await db
    .raw(query)
    .then((rows) => rows.map(parseApplicantsJson).map(transformListing))

  return result
}

/**
 * Gets an applicant by contact code
 *
 * @param {string} contactCode - The applicants contact code
 * @returns {Promise<Applicant | undefined>} - Returns the applicant.
 */
const getApplicantsByContactCode = async (contactCode: string) => {
  const result = await db('Applicant')
    .where({ ContactCode: contactCode })
    .select('*')

  if (result == undefined) {
    return undefined
  }

  // Map result array to Applicant objects
  return result.map(transformDbApplicant)
}

/**
 * Gets an applicant by contact code and rental object code
 *
 * @param {string} contactCode - The applicants contact code.
 * @param {string} rentalObjectCode - The rental object code of the listing that the applicant belongs to.
 * @returns {Promise<Applicant | undefined>} - Returns the applicant.
 */
const getApplicantsByContactCodeAndRentalObjectCode = async (
  contactCode: string,
  rentalObjectCode: string
) => {
  const result = await db('Applicant')
    .where({
      ContactCode: contactCode,
      RentalObjectCode: rentalObjectCode,
    })
    .first()

  if (result == undefined) return undefined

  return transformDbApplicant(result)
}

/**
 * Checks if an applicant has a applied for a listing
 *
 * @param {string} contactCode - The applicants contact code.
 * @param {number} listingId - The ID of the listing the applicant belongs to.
 * @returns {Promise<boolean>} - Returns true if applicant belongs to listing, false if not.
 */
const applicationExists = async (contactCode: string, listingId: number) => {
  const result = await db('applicant')
    .where({
      ContactCode: contactCode,
      ListingId: listingId,
    })
    .first()
  return !!result // Convert result to boolean: true if exists, false if not
}

export {
  createListing,
  createApplication,
  getListingById,
  getListingByRentalObjectCode,
  getAllListingsWithApplicants,
  getApplicantById,
  getApplicantsByContactCode,
  getApplicantsByContactCodeAndRentalObjectCode,
  applicationExists,
  updateApplicantStatus,
}
