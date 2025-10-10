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
  const result = await dbConnection
    .from('listing_text_content AS ltc')
    .select<DbListingTextContent>(
      'ltc.id AS Id',
      'ltc.rentalObjectCode AS RentalObjectCode',
      'ltc.contentBlocks AS ContentBlocks',
      'ltc.createdAt AS CreatedAt',
      'ltc.updatedAt AS UpdatedAt'
    )
    .where({
      RentalObjectCode: rentalObjectCode,
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
    return {
      ok: false,
      err: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

const update = async (
  id: number,
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
      .where({ Id: id })
      .update(updateFields)
      .returning('*')

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
  id: number,
  dbConnection = db
): Promise<AdapterResult<void, Error>> => {
  try {
    await dbConnection.table('listing_text_content').where({ Id: id }).delete()

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
