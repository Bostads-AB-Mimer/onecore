import { leasing } from '@onecore/types'
import { DbListingTextContent, AdapterResult } from './types'
import z from 'zod'

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
    id: row.id,
    rentalObjectCode: row.rentalObjectCode,
    contentBlocks: JSON.parse(row.contentBlocks),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

const getByRentalObjectCode = async (
  rentalObjectCode: string,
  dbConnection = db
): Promise<ListingTextContent | undefined> => {
  const result = await dbConnection
    .from('listing_text_content AS ltc')
    .select<DbListingTextContent>(
      'ltc.id AS id',
      'ltc.rentalObjectCode AS rentalObjectCode',
      'ltc.contentBlocks AS contentBlocks',
      'ltc.createdAt AS createdAt',
      'ltc.updatedAt AS updatedAt'
    )
    .where({
      rentalObjectCode: rentalObjectCode,
    })
    .first()

  return result ? transformFromDbListingTextContent(result) : undefined
}

const create = async (
  listingTextContent: CreateListingTextContentRequest,
  dbConnection = db
): Promise<AdapterResult<ListingTextContent, Error>> => {
  try {
    const [inserted] = await dbConnection
      .table('listing_text_content')
      .insert({
        RentalObjectCode: listingTextContent.rentalObjectCode,
        ContentBlocks: JSON.stringify(listingTextContent.contentBlocks),
      })
      .returning('*')

    return {
      ok: true,
      data: transformFromDbListingTextContent(inserted),
    }
  } catch (error) {
    // Check if this is a unique constraint violation
    if (
      error instanceof Error &&
      (error.message.includes('UQ_listing_text_content_rental_object_code') ||
        error.message.includes('duplicate') ||
        error.message.includes('unique') ||
        (error as any).code === '23505') // PostgreSQL error code
    ) {
      return {
        ok: false,
        err: new Error(
          `Listing text content already exists for rental object code: ${listingTextContent.rentalObjectCode}`
        ),
      }
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
      return {
        ok: false,
        err: new Error(`Listing text content for rental object code ${rentalObjectCode} not found`),
      }
    }

    return {
      ok: true,
      data: transformFromDbListingTextContent(updated),
    }
  } catch (error) {
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
    const deletedCount = await dbConnection
      .table('listing_text_content')
      .where({ RentalObjectCode: rentalObjectCode })
      .delete()

    if (deletedCount === 0) {
      return {
        ok: false,
        err: new Error(`Listing text content for rental object code ${rentalObjectCode} not found`),
      }
    }

    return {
      ok: true,
      data: undefined,
    }
  } catch (error) {
    return {
      ok: false,
      err: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

export default { getByRentalObjectCode, create, update, remove }
