import listingTextContentAdapter from '../../adapters/listing-text-content-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

describe('listing-text-content-adapter', () => {
  describe(listingTextContentAdapter.getByRentalObjectCode, () => {
    it('returns undefined when no content exists', () =>
      withContext(async (ctx) => {
        const result = await listingTextContentAdapter.getByRentalObjectCode(
          'NON_EXISTENT_CODE',
          ctx.db
        )

        expect(result).toBeUndefined()
      }))

    it('returns content when found', () =>
      withContext(async (ctx) => {
        const testData = factory.listingTextContent.build()
        const createResult = await listingTextContentAdapter.create(
          {
            rentalObjectCode: testData.rentalObjectCode,
            contentBlocks: testData.contentBlocks,
          },
          ctx.db
        )

        expect(createResult.ok).toBe(true)

        const result = await listingTextContentAdapter.getByRentalObjectCode(
          testData.rentalObjectCode,
          ctx.db
        )

        expect(result).toBeDefined()
        expect(result?.rentalObjectCode).toBe(testData.rentalObjectCode)
        expect(result?.contentBlocks).toEqual(testData.contentBlocks)
      }))
  })

  describe(listingTextContentAdapter.create, () => {
    it('creates new content successfully', () =>
      withContext(async (ctx) => {
        const testData = factory.listingTextContent.build()
        const result = await listingTextContentAdapter.create(
          {
            rentalObjectCode: testData.rentalObjectCode,
            contentBlocks: testData.contentBlocks,
          },
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.rentalObjectCode).toBe(testData.rentalObjectCode)
          expect(result.data.contentBlocks).toEqual(testData.contentBlocks)
          expect(result.data.id).toBeDefined()
          expect(result.data.createdAt).toBeDefined()
          expect(result.data.updatedAt).toBeDefined()
        }
      }))

    it('returns error for duplicate rental object code', () =>
      withContext(async (ctx) => {
        const testData = factory.listingTextContent.build()

        // Create first entry
        const firstResult = await listingTextContentAdapter.create(
          {
            rentalObjectCode: testData.rentalObjectCode,
            contentBlocks: testData.contentBlocks,
          },
          ctx.db
        )
        expect(firstResult.ok).toBe(true)

        // Try to create duplicate
        const duplicateResult = await listingTextContentAdapter.create(
          {
            rentalObjectCode: testData.rentalObjectCode,
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

  describe(listingTextContentAdapter.update, () => {
    it('updates existing content', () =>
      withContext(async (ctx) => {
        const testData = factory.listingTextContent.build()

        // Create first
        const createResult = await listingTextContentAdapter.create(
          {
            rentalObjectCode: testData.rentalObjectCode,
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
        const updateResult = await listingTextContentAdapter.update(
          testData.rentalObjectCode,
          { contentBlocks: newContentBlocks },
          ctx.db
        )

        expect(updateResult.ok).toBe(true)
        if (updateResult.ok) {
          expect(updateResult.data.contentBlocks).toEqual(newContentBlocks)
          expect(updateResult.data.rentalObjectCode).toBe(
            testData.rentalObjectCode
          )
        }
      }))

    it('returns error when not found', () =>
      withContext(async (ctx) => {
        const result = await listingTextContentAdapter.update(
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

  describe(listingTextContentAdapter.remove, () => {
    it('deletes content successfully', () =>
      withContext(async (ctx) => {
        const testData = factory.listingTextContent.build()

        // Create first
        const createResult = await listingTextContentAdapter.create(
          {
            rentalObjectCode: testData.rentalObjectCode,
            contentBlocks: testData.contentBlocks,
          },
          ctx.db
        )
        expect(createResult.ok).toBe(true)

        // Delete
        const deleteResult = await listingTextContentAdapter.remove(
          testData.rentalObjectCode,
          ctx.db
        )

        expect(deleteResult.ok).toBe(true)

        // Verify deleted
        const findResult =
          await listingTextContentAdapter.getByRentalObjectCode(
            testData.rentalObjectCode,
            ctx.db
          )
        expect(findResult).toBeUndefined()
      }))

    it('returns error when not found', () =>
      withContext(async (ctx) => {
        const result = await listingTextContentAdapter.remove(
          'NON_EXISTENT_CODE',
          ctx.db
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.err.message).toContain('not found')
        }
      }))
  })

  describe('link content blocks', () => {
    it('creates content with link blocks successfully', () =>
      withContext(async (ctx) => {
        const testData = factory.listingTextContent.build()
        const contentBlocksWithLinks = [
          { type: 'headline' as const, content: 'Test Headline' },
          { type: 'text' as const, content: 'Test text content' },
          {
            type: 'link' as const,
            name: 'Virtual Tour',
            url: 'https://example.com/tour',
          },
          {
            type: 'link' as const,
            name: 'Area Guide',
            url: 'https://example.com/area',
          },
        ]

        const result = await listingTextContentAdapter.create(
          {
            rentalObjectCode: testData.rentalObjectCode,
            contentBlocks: contentBlocksWithLinks,
          },
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.contentBlocks).toEqual(contentBlocksWithLinks)
          // Verify link blocks are included
          const linkBlocks = result.data.contentBlocks.filter(
            (block) => block.type === 'link'
          )
          expect(linkBlocks).toHaveLength(2)
        }
      }))

    it('updates content blocks including links', () =>
      withContext(async (ctx) => {
        const testData = factory.listingTextContent.build()

        // Create without link blocks
        const createResult = await listingTextContentAdapter.create(
          {
            rentalObjectCode: testData.rentalObjectCode,
            contentBlocks: testData.contentBlocks,
          },
          ctx.db
        )
        expect(createResult.ok).toBe(true)

        // Update with link blocks
        const newContentBlocks = [
          { type: 'headline' as const, content: 'Updated Headline' },
          {
            type: 'link' as const,
            name: 'Documentation',
            url: 'https://docs.example.com',
          },
        ]
        const updateResult = await listingTextContentAdapter.update(
          testData.rentalObjectCode,
          { contentBlocks: newContentBlocks },
          ctx.db
        )

        expect(updateResult.ok).toBe(true)
        if (updateResult.ok) {
          expect(updateResult.data.contentBlocks).toEqual(newContentBlocks)
        }
      }))

    it('allows mixed content blocks and links in any order', () =>
      withContext(async (ctx) => {
        const testData = factory.listingTextContent.build()
        // Links interspersed with content blocks
        const mixedContentBlocks = [
          { type: 'headline' as const, content: 'Welcome' },
          {
            type: 'link' as const,
            name: 'Virtual Tour',
            url: 'https://example.com/tour',
          },
          { type: 'text' as const, content: 'Description text' },
          {
            type: 'link' as const,
            name: 'Contact',
            url: 'https://example.com/contact',
          },
          { type: 'bullet_list' as const, content: 'Item 1\nItem 2' },
        ]

        const result = await listingTextContentAdapter.create(
          {
            rentalObjectCode: testData.rentalObjectCode,
            contentBlocks: mixedContentBlocks,
          },
          ctx.db
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.contentBlocks).toEqual(mixedContentBlocks)
          // Order should be preserved
          expect(result.data.contentBlocks[0].type).toBe('headline')
          expect(result.data.contentBlocks[1].type).toBe('link')
          expect(result.data.contentBlocks[2].type).toBe('text')
          expect(result.data.contentBlocks[3].type).toBe('link')
          expect(result.data.contentBlocks[4].type).toBe('bullet_list')
        }
      }))
  })
})
