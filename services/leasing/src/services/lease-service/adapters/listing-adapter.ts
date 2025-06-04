import { logger } from 'onecore-utilities'
import {
  Applicant,
  Listing,
  ApplicantStatus,
  ListingStatus,
  GetListingsWithApplicantsFilterParams,
  OfferStatus,
} from 'onecore-types'
import { RequestError } from 'tedious'
import { Knex } from 'knex'
import { match } from 'ts-pattern'

import { db } from './db'
import { AdapterResult, DbApplicant, DbListing } from './types'

function transformFromDbListing(row: DbListing): Listing {
  return {
    id: row.Id,
    rentalObjectCode: row.RentalObjectCode,
    address: row.Address,
    monthlyRent: row.MonthlyRent,
    districtCaption: row.DistrictCaption || undefined,
    districtCode: row.DistrictCode || undefined,
    blockCaption: row.BlockCaption || undefined,
    blockCode: row.BlockCode || undefined,
    objectTypeCaption: row.ObjectTypeCaption || undefined,
    objectTypeCode: row.ObjectTypeCode || undefined,
    rentalObjectTypeCaption: row.RentalObjectTypeCaption || undefined,
    rentalObjectTypeCode: row.RentalObjectTypeCode || undefined,
    publishedFrom: row.PublishedFrom || undefined,
    publishedTo: row.PublishedTo,
    vacantFrom: row.VacantFrom,
    status: row.Status,
    waitingListType: row.WaitingListType || undefined,
    applicants: undefined,
  }
}

function transformDbApplicant(row: DbApplicant): Applicant {
  return {
    id: row.Id,
    name: row.Name,
    nationalRegistrationNumber: row.NationalRegistrationNumber,
    contactCode: row.ContactCode,
    applicationDate: row.ApplicationDate,
    applicationType: row.ApplicationType || undefined,
    status: row.Status,
    listingId: row.ListingId,
  }
}

const createListing = async (
  listingData: Omit<Listing, 'id'>,
  dbConnection = db
): Promise<AdapterResult<Listing, 'conflict-active-listing' | 'unknown'>> => {
  try {
    const insertedRow = await dbConnection<DbListing>('Listing')
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

    return { ok: true, data: transformFromDbListing(insertedRow[0]) }
  } catch (err) {
    if (err instanceof RequestError) {
      if (err.message.includes('unique_rental_object_code_status')) {
        logger.info(
          {
            RentalObjectCode: listingData.rentalObjectCode,
            Status: listingData.status,
          },
          'listingAdapter.createListing - can not insert duplicate active listing'
        )
        return { ok: false, err: 'conflict-active-listing' }
      }

      logger.error(
        {
          RentalObjectCode: listingData.rentalObjectCode,
          err,
        },
        'listingAdapter.createListing'
      )
    }

    return { ok: false, err: 'unknown' }
  }
}

/**
 * Checks if an active listing already exists based on unique criteria.
 *
 * @param {string} rentalObjectCode - The rental object code of the active listing (originally from xpand)
 * @returns {Promise<Listing>} - Promise that resolves to the existing listing if it exists.
 */
const getActiveListingByRentalObjectCode = async (
  rentalObjectCode: string,
  dbConnection = db
): Promise<Listing | undefined> => {
  const listing = await dbConnection<DbListing>('Listing')
    .where({
      RentalObjectCode: rentalObjectCode,
      Status: ListingStatus.Active,
    })
    .first()

  if (listing == undefined) {
    return undefined
  }
  return transformFromDbListing(listing)
}

const getListingById = async (
  listingId: number,
  dbConnection = db
): Promise<Listing | undefined> => {
  logger.info({ listingId }, `Getting listing ${listingId} from leasing DB`)
  const result = await dbConnection
    .from('listing AS l')
    .select<DbListing & { applicants: string | null }>(
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

  const parseApplicantsJson = (applicants: string | null) =>
    applicants ? JSON.parse(applicants) : []

  const parseApplicantsApplicationDate = (applicant: Applicant): Applicant => ({
    ...applicant,
    applicationDate: new Date(applicant.applicationDate),
  })

  const transformListing = (
    row: DbListing & { applicants: Array<DbApplicant> }
  ): Listing => ({
    ...transformFromDbListing(row),
    applicants: row.applicants
      .map(transformDbApplicant)
      .map(parseApplicantsApplicationDate),
  })

  if (!result) {
    logger.info(
      { listingId },
      'Getting listing from leasing DB complete - listing not found'
    )
    return undefined
  }

  logger.info({ listingId }, 'Getting listing from leasing DB complete')

  return transformListing({
    ...result,
    applicants: parseApplicantsJson(result.applicants),
  })
}

/**
 * Gets an applicant by id
 *
 * @param {number} applicantId - The ID of the applicant.
 * @returns {Promise<Applicant | undefined>} - Returns the applicant.
 */
const getApplicantById = async (
  applicantId: number,
  dbConnection = db
): Promise<Applicant | undefined> => {
  logger.info({ applicantId }, 'Getting applicant from leasing DB')
  const applicant = await dbConnection<DbApplicant>('Applicant')
    .where({
      Id: applicantId,
    })
    .first()

  if (applicant == undefined) {
    logger.info(
      { applicantId },
      'Getting applicant from leasing DB complete - applicant not found'
    )
    return undefined
  }

  logger.info({ applicantId }, 'Getting applicant from leasing DB complete')

  return transformDbApplicant(applicant)
}

const createApplication = async (
  applicationData: Omit<Applicant, 'id'>,
  dbConnection = db
) => {
  logger.info(
    { contactCode: applicationData.contactCode },
    'Creating application in listing DB'
  )

  const insertedRow = await dbConnection('applicant')
    .insert({
      Name: applicationData.name,
      NationalRegistrationNumber: applicationData.nationalRegistrationNumber,
      ContactCode: applicationData.contactCode,
      ApplicationDate: applicationData.applicationDate,
      ApplicationType: applicationData.applicationType,
      Status: applicationData.status,
      ListingId: applicationData.listingId,
    })
    .returning('*')

  logger.info(
    { contactCode: applicationData.contactCode },
    'Creating application in listing DB complete'
  )
  return transformDbApplicant(insertedRow[0])
}

const updateApplicantStatus = async (
  dbConnection: Knex<any, unknown[]>,
  params: {
    applicantId: number
    status: ApplicantStatus
    applicationType?: string
  }
): Promise<AdapterResult<null, 'no-update' | 'unknown'>> => {
  try {
    const query = await dbConnection('applicant')
      .where('Id', params.applicantId)
      .update({
        Status: params.status,
        ApplicationType: dbConnection.raw('COALESCE(?, "ApplicationType")', [
          params.applicationType ?? null,
        ]),
      })
    if (!query) {
      return { ok: false, err: 'no-update' }
    }

    return { ok: true, data: null }
  } catch (_error) {
    return { ok: false, err: 'unknown' }
  }
}

const getListings = async (
  published?: boolean,
  rentalRule?: 'Scored' | 'NonScored',
  dbConnection = db
): Promise<AdapterResult<Array<Listing>, 'unknown'>> => {
  try {
    const now = new Date()

    const listings = await dbConnection('listing').where((builder) => {
      if (published) {
        builder
          .where('Status', '=', ListingStatus.Active)
          .andWhere('PublishedFrom', '<=', now)
          .andWhere('PublishedTo', '>=', now)
      }
      if (rentalRule) {
        builder.andWhere('WaitingListType', '=', rentalRule)
      }
    })

    return { ok: true, data: listings.map(transformFromDbListing) }
  } catch (err) {
    logger.error(err, 'listingAdapter.getListings')
    return { ok: false, err: 'unknown' }
  }
}

const getListingsWithApplicants = async (
  db: Knex,
  opts?: GetListingsWithApplicantsFilterParams
): Promise<AdapterResult<Array<Listing>, 'unknown'>> => {
  try {
    const whereClause = match(opts?.by)
      .with({ type: 'published' }, () =>
        db.raw('WHERE l.Status = ?', [ListingStatus.Active])
      )
      .with({ type: 'historical' }, () =>
        db.raw(
          `WHERE l.Status = ?
           OR (l.Status = ? AND EXISTS (
              SELECT 1
              FROM applicant a
              WHERE a.ListingId = l.Id
           ))
          `,
          [ListingStatus.Assigned, ListingStatus.Closed]
        )
      )
      .with({ type: 'ready-for-offer' }, () =>
        db.raw(
          `WHERE l.Status = ?
          AND EXISTS (
            SELECT 1
            FROM applicant a
            WHERE a.ListingId = l.Id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM offer o
            WHERE o.ListingId = l.Id
          )
          `,
          [ListingStatus.Expired]
        )
      )
      .with({ type: 'offered' }, () =>
        db.raw(
          `WHERE l.Status = ?
          AND EXISTS (
            SELECT 1
            FROM offer o
            WHERE o.ListingId = l.Id
            AND o.Status = ?
          )`,
          [ListingStatus.Expired, OfferStatus.Active]
        )
      )
      .with({ type: 'needs-republish' }, () =>
        db.raw(`WHERE l.Status = ?`, [ListingStatus.NoApplicants])
      )
      .otherwise(() => db.raw('WHERE 1=1'))

    const listings = db.raw<Array<DbListing & { applicants: string | null }>>(
      `
        SELECT l.*,
        (
          SELECT a.*
          FROM applicant a
          WHERE a.ListingId = l.Id
          FOR JSON PATH
        ) as applicants
        FROM listing l
        ${whereClause}
      `
    )

    const parseApplicantsJson = (applicants: string | null) =>
      applicants ? JSON.parse(applicants) : []

    const parseApplicantsApplicationDate = (
      applicant: Applicant
    ): Applicant => ({
      ...applicant,
      applicationDate: new Date(applicant.applicationDate),
    })

    const transformListing = (
      row: DbListing & { applicants: Array<DbApplicant> }
    ): Listing => ({
      ...transformFromDbListing(row),
      applicants: row.applicants
        .map(transformDbApplicant)
        .map(parseApplicantsApplicationDate),
    })

    const result = await listings.then((rows) =>
      rows.map((row) =>
        transformListing({
          ...row,
          applicants: parseApplicantsJson(row.applicants),
        })
      )
    )

    return { ok: true, data: result }
  } catch (err) {
    logger.error(err, 'listingAdapter.getListingsWithApplicants')
    return { ok: false, err: 'unknown' }
  }
}

/**
 * Gets all applicants by contact code
 *
 * @param {string} contactCode - The applicants contact code
 * @returns {Promise<Applicant | undefined>} - Returns the applicants.
 */

const getApplicantsByContactCode = async (
  contactCode: string,
  dbConnection = db
) => {
  const result = await dbConnection('Applicant')
    .where({ ContactCode: contactCode })
    .select<Array<DbApplicant>>('*')

  return result.map(transformDbApplicant)
}

/**
 * Gets an applicant by contact code and rental object code
 *
 * @param {string} contactCode - The applicants contact code.
 * @param {string} listingId - The id of the listing that the applicant belongs to.
 * @returns {Promise<Applicant | undefined>} - Returns the applicant.
 */
const getApplicantByContactCodeAndListingId = async (
  contactCode: string,
  listingId: number,
  dbConnection = db
) => {
  const result = await dbConnection<DbApplicant>('Applicant')
    .where({
      ContactCode: contactCode,
      ListingId: listingId,
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
const applicationExists = async (
  contactCode: string,
  listingId: number,
  dbConnection = db
) => {
  const result = await dbConnection<DbApplicant>('applicant')
    .where({
      ContactCode: contactCode,
      ListingId: listingId,
    })
    .first()

  if (!result) {
    return false
  }

  return true
}

const getExpiredListings = async (dbConnection = db) => {
  const currentDate = new Date()
  const listings = await dbConnection('listing')
    .where('PublishedTo', '<', currentDate)
    .andWhere('Status', '=', ListingStatus.Active)
  return listings
}

const getExpiredListingsWithNoOffers = async (): Promise<
  AdapterResult<Array<Listing>, 'unknown'>
> => {
  const dbListings = await db('listing')
    .leftJoin('offer', 'offer.ListingId', 'listing.Id')
    .whereNull('offer.ListingId')
    .where('listing.Status', '=', ListingStatus.Expired)

  const listings = dbListings.map((dbListing) => {
    const listing = transformFromDbListing(dbListing)
    // Manual transformations because colliding column names due to left join
    listing.id = dbListing.Id[0]
    listing.status = dbListing.Status[0]

    return listing
  })

  return { ok: true, data: listings }
}

const updateListingStatuses = async (
  listingIds: number[],
  status: ListingStatus,
  dbConnection: Knex<any, unknown[]> = db
): Promise<AdapterResult<null, 'no-update' | 'unknown'>> => {
  try {
    const query = await dbConnection('listing')
      .whereIn('Id', listingIds)
      .update({ Status: status })

    if (!query) {
      return { ok: false, err: 'no-update' }
    }
    return { ok: true, data: null }
  } catch (err) {
    logger.error(err, 'listingAdapter.updateListingStatuses')
    return { ok: false, err: 'unknown' }
  }
}

const deleteListing = async (
  listingId: number,
  dbConnection = db
): Promise<AdapterResult<null, 'unknown' | 'conflict'>> => {
  try {
    await dbConnection('listing').delete().where('Id', listingId)
    return { ok: true, data: null }
  } catch (err) {
    logger.error(err, 'listingAdapter.deleteListing')
    if (err instanceof RequestError) {
      if (err.message.includes('constraint')) {
        return { ok: false, err: 'conflict' }
      }
    }

    return { ok: false, err: 'unknown' }
  }
}

export {
  createListing,
  createApplication,
  getListingById,
  getActiveListingByRentalObjectCode,
  getExpiredListingsWithNoOffers,
  getListings,
  getListingsWithApplicants,
  getApplicantById,
  getApplicantsByContactCode,
  getApplicantByContactCodeAndListingId,
  applicationExists,
  updateApplicantStatus,
  getExpiredListings,
  updateListingStatuses,
  deleteListing,
}
