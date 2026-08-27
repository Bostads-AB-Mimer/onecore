import { leasing } from '@onecore/types'
import { DbListingAreaTextContent, AdapterResult } from './types'
import z from 'zod'
import { logger } from '@onecore/utilities'
import { RequestError } from 'tedious'

import { db } from './db'

type ListingAreaTextContent = z.infer<
  typeof leasing.v1.ListingAreaTextContentSchema
>
type CreateListingAreaTextContentRequest = z.infer<
  typeof leasing.v1.CreateListingAreaTextContentRequestSchema
>
type UpdateListingAreaTextContentRequest = z.infer<
  typeof leasing.v1.UpdateListingAreaTextContentRequestSchema
>

type ContentBlock = z.infer<typeof leasing.v1.ContentBlockSchema>

function transformFromDbListingAreaTextContent(
  row: DbListingAreaTextContent
): ListingAreaTextContent {
  const contentBlocks = JSON.parse(row.ContentBlocks) as ContentBlock[]

  return {
    id: row.Id,
    marketAreaCode: row.MarketAreaCode,
    contentBlocks,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  }
}

const list = async (dbConnection = db): Promise<ListingAreaTextContent[]> => {
  try {
    const result = await dbConnection
      .from('listing_area_text_content AS latc')
      .select<
        DbListingAreaTextContent[]
      >('latc.Id', 'latc.MarketAreaCode', 'latc.ContentBlocks', 'latc.CreatedAt', 'latc.UpdatedAt')
      .orderBy('latc.MarketAreaCode')

    return result.map(transformFromDbListingAreaTextContent)
  } catch (err) {
    logger.error({ err }, 'listingAreaTextContentAdapter.list')
    throw err
  }
}

const getByMarketAreaCode = async (
  marketAreaCode: string,
  dbConnection = db
): Promise<ListingAreaTextContent | undefined> => {
  try {
    const result = await dbConnection
      .from('listing_area_text_content AS latc')
      .select<DbListingAreaTextContent>(
        'latc.Id',
        'latc.MarketAreaCode',
        'latc.ContentBlocks',
        'latc.CreatedAt',
        'latc.UpdatedAt'
      )
      .where({
        MarketAreaCode: marketAreaCode,
      })
      .first()

    if (!result) {
      logger.info(
        { marketAreaCode },
        'Getting listing area text content from leasing DB complete - not found'
      )
      return undefined
    }

    return transformFromDbListingAreaTextContent(result)
  } catch (err) {
    logger.error(
      { err, marketAreaCode },
      'listingAreaTextContentAdapter.getByMarketAreaCode'
    )
    throw err
  }
}

const create = async (
  listingAreaTextContent: CreateListingAreaTextContentRequest,
  dbConnection = db
): Promise<AdapterResult<ListingAreaTextContent, Error>> => {
  try {
    const [inserted] = await dbConnection
      .table('listing_area_text_content')
      .insert({
        MarketAreaCode: listingAreaTextContent.marketAreaCode,
        ContentBlocks: JSON.stringify(listingAreaTextContent.contentBlocks),
      })
      .returning('*')

    return {
      ok: true,
      data: transformFromDbListingAreaTextContent(inserted),
    }
  } catch (err) {
    // Check if this is a unique constraint violation (SQL Server pattern)
    const isDuplicate =
      err instanceof RequestError &&
      (err.message.includes('UQ_listing_area_text_content_market_area_code') ||
        err.message.includes('unique'))

    if (isDuplicate) {
      logger.info(
        { marketAreaCode: listingAreaTextContent.marketAreaCode },
        'listingAreaTextContentAdapter.create - cannot insert duplicate market area code'
      )
      return {
        ok: false,
        err: new Error(
          `Listing area text content already exists for market area code: ${listingAreaTextContent.marketAreaCode}`
        ),
      }
    }

    logger.error(
      { err, marketAreaCode: listingAreaTextContent.marketAreaCode },
      'listingAreaTextContentAdapter.create'
    )

    return {
      ok: false,
      err: err instanceof Error ? err : new Error('Unknown error'),
    }
  }
}

const update = async (
  marketAreaCode: string,
  updateData: UpdateListingAreaTextContentRequest,
  dbConnection = db
): Promise<AdapterResult<ListingAreaTextContent, Error>> => {
  try {
    const updateFields: Record<string, unknown> = {}

    if (updateData.contentBlocks !== undefined) {
      updateFields.ContentBlocks = JSON.stringify(updateData.contentBlocks)
    }

    // Always update the updatedAt timestamp
    updateFields.UpdatedAt = new Date()

    const [updated] = await dbConnection
      .table('listing_area_text_content')
      .where({ MarketAreaCode: marketAreaCode })
      .update(updateFields)
      .returning('*')

    if (!updated) {
      logger.info(
        { marketAreaCode },
        'Updating listing area text content in leasing DB complete - not found'
      )
      return {
        ok: false,
        err: new Error(
          `Listing area text content for market area code ${marketAreaCode} not found`
        ),
      }
    }

    return {
      ok: true,
      data: transformFromDbListingAreaTextContent(updated),
    }
  } catch (err) {
    logger.error(
      { err, marketAreaCode },
      'listingAreaTextContentAdapter.update'
    )
    return {
      ok: false,
      err: err instanceof Error ? err : new Error('Unknown error'),
    }
  }
}

const remove = async (
  marketAreaCode: string,
  dbConnection = db
): Promise<AdapterResult<void, Error>> => {
  try {
    const deletedCount = await dbConnection
      .table('listing_area_text_content')
      .where({ MarketAreaCode: marketAreaCode })
      .delete()

    if (deletedCount === 0) {
      logger.info(
        { marketAreaCode },
        'Deleting listing area text content from leasing DB complete - not found'
      )
      return {
        ok: false,
        err: new Error(
          `Listing area text content for market area code ${marketAreaCode} not found`
        ),
      }
    }

    return {
      ok: true,
      data: undefined,
    }
  } catch (err) {
    logger.error(
      { err, marketAreaCode },
      'listingAreaTextContentAdapter.remove'
    )
    return {
      ok: false,
      err: err instanceof Error ? err : new Error('Unknown error'),
    }
  }
}

export default { list, getByMarketAreaCode, create, update, remove }
