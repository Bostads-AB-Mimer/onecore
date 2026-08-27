import listingAreaTextContentAdapter from '../../adapters/listing-area-text-content-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

describe('listing-area-text-content-adapter', () => {
  describe(listingAreaTextContentAdapter.list, () => {
    it('returns an empty list when no content exists', () =>
      withContext(async (ctx) => {
        const result = await listingAreaTextContentAdapter.list(ctx.db)

        expect(result).toEqual([])
      }))

    it('returns all content ordered by market area code', () =>
      withContext(async (ctx) => {
        const first = factory.listingAreaTextContent.build({
          marketAreaCode: 'BBB',
        })
        const second = factory.listingAreaTextContent.build({
          marketAreaCode: 'AAA',
        })

        await listingAreaTextContentAdapter.create(
          {
            marketAreaCode: first.marketAreaCode,
            contentBlocks: first.contentBlocks,
          },
          ctx.db
        )
        await listingAreaTextContentAdapter.create(
          {
            marketAreaCode: second.marketAreaCode,
            contentBlocks: second.contentBlocks,
          },
          ctx.db
        )

        const result = await listingAreaTextContentAdapter.list(ctx.db)

        expect(result).toHaveLength(2)
        expect(result[0].marketAreaCode).toBe('AAA')
        expect(result[1].marketAreaCode).toBe('BBB')
      }))
  })

  describe(listingAreaTextContentAdapter.getByMarketAreaCode, () => {
    it('returns undefined when no content exists', () =>
      withContext(async (ctx) => {
        const result = await listingAreaTextContentAdapter.getByMarketAreaCode(
          'NON_EXISTENT_CODE',
          ctx.db
        )

        expect(result).toBeUndefined()
      }))

    it('returns content when found', () =>
      withContext(async (ctx) => {
        const testData = factory.listingAreaTextContent.build()
        const createResult = await listingAreaTextContentAdapter.create(
          {
            marketAreaCode: testData.marketAreaCode,
            contentBlocks: testData.contentBlocks,
          },
          ctx.db
        )

        expect(createResult.ok).toBe(true)

        const result = await listingAreaTextContentAdapter.getByMarketAreaCode(
          testData.marketAreaCode,
          ctx.db
        )

        expect(result).toBeDefined()
        expect(result?.marketAreaCode).toBe(testData.marketAreaCode)
        expect(result?.contentBlocks).toEqual(testData.contentBlocks)
      }))
  })

  describe(listingAreaTextContentAdapter.create, () => {
    it('creates new content successfully', () =>
      withContext(async (ctx) => {
        const testData = factory.listingAreaTextContent.build()
        const result = await listingAreaTextContentAdapter.create(
          {
            marketAreaCode: testData.marketAreaCode,
            contentBlocks: testData.contentBlocks,
          },
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.marketAreaCode).toBe(testData.marketAreaCode)
          expect(result.data.contentBlocks).toEqual(testData.contentBlocks)
          expect(result.data.id).toBeDefined()
          expect(result.data.createdAt).toBeDefined()
          expect(result.data.updatedAt).toBeDefined()
        }
      }))

    it('returns error for duplicate market area code', () =>
      withContext(async (ctx) => {
        const testData = factory.listingAreaTextContent.build()

        // Create first entry
        const firstResult = await listingAreaTextContentAdapter.create(
          {
            marketAreaCode: testData.marketAreaCode,
            contentBlocks: testData.contentBlocks,
          },
          ctx.db
        )
        expect(firstResult.ok).toBe(true)

        // Try to create duplicate
        const duplicateResult = await listingAreaTextContentAdapter.create(
          {
            marketAreaCode: testData.marketAreaCode,
            contentBlocks: [{ type: 'text', content: 'Different content' }],
          },
          ctx.db
        )

        expect(duplicateResult.ok).toBe(false)
        if (!duplicateResult.ok) {
          expect(duplicateResult.err.message).toContain('already exists')
        }
      }))
  })

  describe(listingAreaTextContentAdapter.update, () => {
    it('updates existing content', () =>
      withContext(async (ctx) => {
        const testData = factory.listingAreaTextContent.build()

        // Create first
        const createResult = await listingAreaTextContentAdapter.create(
          {
            marketAreaCode: testData.marketAreaCode,
            contentBlocks: testData.contentBlocks,
          },
          ctx.db
        )
        expect(createResult.ok).toBe(true)

        // Update
        const newContentBlocks = [
          { type: 'headline' as const, content: 'Updated Headline' },
          { type: 'text' as const, content: 'Updated text content' },
        ]
        const updateResult = await listingAreaTextContentAdapter.update(
          testData.marketAreaCode,
          { contentBlocks: newContentBlocks },
          ctx.db
        )

        expect(updateResult.ok).toBe(true)
        if (updateResult.ok) {
          expect(updateResult.data.contentBlocks).toEqual(newContentBlocks)
          expect(updateResult.data.marketAreaCode).toBe(testData.marketAreaCode)
        }
      }))

    it('returns error when not found', () =>
      withContext(async (ctx) => {
        const result = await listingAreaTextContentAdapter.update(
          'NON_EXISTENT_CODE',
          {
            contentBlocks: [{ type: 'text', content: 'Some content' }],
          },
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err.message).toContain('not found')
        }
      }))
  })

  describe(listingAreaTextContentAdapter.remove, () => {
    it('deletes content successfully', () =>
      withContext(async (ctx) => {
        const testData = factory.listingAreaTextContent.build()

        // Create first
        const createResult = await listingAreaTextContentAdapter.create(
          {
            marketAreaCode: testData.marketAreaCode,
            contentBlocks: testData.contentBlocks,
          },
          ctx.db
        )
        expect(createResult.ok).toBe(true)

        // Delete
        const deleteResult = await listingAreaTextContentAdapter.remove(
          testData.marketAreaCode,
          ctx.db
        )

        expect(deleteResult.ok).toBe(true)

        // Verify deleted
        const findResult =
          await listingAreaTextContentAdapter.getByMarketAreaCode(
            testData.marketAreaCode,
            ctx.db
          )
        expect(findResult).toBeUndefined()
      }))

    it('returns error when not found', () =>
      withContext(async (ctx) => {
        const result = await listingAreaTextContentAdapter.remove(
          'NON_EXISTENT_CODE',
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err.message).toContain('not found')
        }
      }))
  })
})
