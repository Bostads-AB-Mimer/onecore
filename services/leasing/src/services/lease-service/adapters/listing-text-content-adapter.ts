import { leasing } from '@onecore/types'
import { DbListingTextContent, AdapterResult } from './types'
import z from 'zod'
import { logger } from '@onecore/utilities'
import { RequestError } from 'tedious'

import { db } from './db'

type ListingTextContent = z.infer<typeof leasing.v1.ListingTextContentSchema>
type CreateListingTextContentRequest = z.infer<
  typeof leasing.v1.CreateListingTextContentRequestSchema
>
type UpdateListingTextContentRequest = z.infer<
  typeof leasing.v1.UpdateListingTextContentRequestSchema
>

function transformFromDbListingTextContent(
  row: DbListingTextContent
): ListingTextContent {
  return {
    id: row.Id,
    rentalObjectCode: row.RentalObjectCode,
    contentBlocks: JSON.parse(row.ContentBlocks),
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  }
}

const getByRentalObjectCode = async (
  rentalObjectCode: string,
  dbConnection = db
): Promise<ListingTextContent | undefined> => {
  logger.info(
    { rentalObjectCode },
    'Getting listing text content from leasing DB'
  )

  const result = await dbConnection
    .from('listing_text_content AS ltc')
    .select<DbListingTextContent>(
      'ltc.Id',
      'ltc.RentalObjectCode',
      'ltc.ContentBlocks',
      'ltc.CreatedAt',
      'ltc.UpdatedAt'
    )
    .where({
      RentalObjectCode: rentalObjectCode,
    })
    .first()

  if (!result) {
    logger.info(
      { rentalObjectCode },
      'Getting listing text content from leasing DB complete - not found'
    )
    return undefined
  }

  logger.info(
    { rentalObjectCode },
    'Getting listing text content from leasing DB complete'
  )

  return transformFromDbListingTextContent(result)
}

const create = async (
  listingTextContent: CreateListingTextContentRequest,
  dbConnection = db
): Promise<AdapterResult<ListingTextContent, Error>> => {
  try {
    logger.info(
      { rentalObjectCode: listingTextContent.rentalObjectCode },
      'Creating listing text content in leasing DB'
    )

    const [inserted] = await dbConnection
      .table('listing_text_content')
      .insert({
        RentalObjectCode: listingTextContent.rentalObjectCode,
        ContentBlocks: JSON.stringify(listingTextContent.contentBlocks),
      })
      .returning('*')

    logger.info(
      { rentalObjectCode: listingTextContent.rentalObjectCode },
      'Creating listing text content in leasing DB complete'
    )

    return {
      ok: true,
      data: transformFromDbListingTextContent(inserted),
    }
  } catch (error) {
    // Check if this is a unique constraint violation (SQL Server pattern)
    if (error instanceof RequestError) {
      if (
        error.message.includes('UQ_listing_text_content_rental_object_code') ||
        error.message.includes('unique')
      ) {
        logger.info(
          { rentalObjectCode: listingTextContent.rentalObjectCode },
          'listingTextContentAdapter.create - cannot insert duplicate rental object code'
        )
        return {
          ok: false,
          err: new Error(
            `Listing text content already exists for rental object code: ${listingTextContent.rentalObjectCode}`
          ),
        }
      }

      logger.error(
        { rentalObjectCode: listingTextContent.rentalObjectCode, error },
        'listingTextContentAdapter.create'
      )
    }

    return {
      ok: false,
      err: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

const update = async (
  rentalObjectCode: string,
  updateData: UpdateListingTextContentRequest,
  dbConnection = db
): Promise<AdapterResult<ListingTextContent, Error>> => {
  try {
    logger.info(
      { rentalObjectCode },
      'Updating listing text content in leasing DB'
    )

    const updateFields: Record<string, any> = {}

    if (updateData.contentBlocks !== undefined) {
      updateFields.ContentBlocks = JSON.stringify(updateData.contentBlocks)
    }

    // Always update the updatedAt timestamp
    updateFields.UpdatedAt = new Date()

    const [updated] = await dbConnection
      .table('listing_text_content')
      .where({ RentalObjectCode: rentalObjectCode })
      .update(updateFields)
      .returning('*')

    if (!updated) {
      logger.info(
        { rentalObjectCode },
        'Updating listing text content in leasing DB complete - not found'
      )
      return {
        ok: false,
        err: new Error(
          `Listing text content for rental object code ${rentalObjectCode} not found`
        ),
      }
    }

    logger.info(
      { rentalObjectCode },
      'Updating listing text content in leasing DB complete'
    )

    return {
      ok: true,
      data: transformFromDbListingTextContent(updated),
    }
  } catch (error) {
    logger.error(
      { rentalObjectCode, error },
      'listingTextContentAdapter.update'
    )
    return {
      ok: false,
      err: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

const remove = async (
  rentalObjectCode: string,
  dbConnection = db
): Promise<AdapterResult<void, Error>> => {
  try {
    logger.info(
      { rentalObjectCode },
      'Deleting listing text content from leasing DB'
    )

    const deletedCount = await dbConnection
      .table('listing_text_content')
      .where({ RentalObjectCode: rentalObjectCode })
      .delete()

    if (deletedCount === 0) {
      logger.info(
        { rentalObjectCode },
        'Deleting listing text content from leasing DB complete - not found'
      )
      return {
        ok: false,
        err: new Error(
          `Listing text content for rental object code ${rentalObjectCode} not found`
        ),
      }
    }

    logger.info(
      { rentalObjectCode },
      'Deleting listing text content from leasing DB complete'
    )

    return {
      ok: true,
      data: undefined,
    }
  } catch (error) {
    logger.error(
      { rentalObjectCode, error },
      'listingTextContentAdapter.remove'
    )
    return {
      ok: false,
      err: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

export default { getByRentalObjectCode, create, update, remove }
