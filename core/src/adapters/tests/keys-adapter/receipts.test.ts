import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import assert from 'node:assert'
import config from '../../../common/config'
import * as keysAdapter from '../../keys-adapter'
import * as factory from '../../../../test/factories'
import { keys } from '@onecore/types'

const { ReceiptSchema, KeyEventSchema } = keys

const mockedReceipt = JSON.parse(JSON.stringify(factory.receipt.build()))
const mockedKeyNote = JSON.parse(JSON.stringify(factory.keyNote.build()))
const mockedKeyEvent = JSON.parse(JSON.stringify(factory.keyEvent.build()))

const expectedReceipt = ReceiptSchema.parse(mockedReceipt)
const expectedKeyEvent = KeyEventSchema.parse(mockedKeyEvent)

const mockServer = setupServer()

describe('keys-adapter - Receipts, KeyNotes & KeyEvents', () => {
  beforeAll(() => {
    mockServer.listen()
  })

  afterEach(() => {
    mockServer.resetHandlers()
  })

  afterAll(() => {
    mockServer.close()
  })

  // ============================================================================
  // ReceiptsApi Tests
  // ============================================================================

  describe('ReceiptsApi', () => {
    describe(keysAdapter.ReceiptsApi.create, () => {
      it('returns ok with created receipt on 201', async () => {
        const createPayload = {
          keyLoanId: '00000000-0000-0000-0000-000000000001',
          loanType: 'REGULAR' as const,
          receiptType: 'LOAN' as const,
          type: 'DIGITAL' as const,
        }

        mockServer.use(
          http.post(`${config.keysService.url}/receipts`, () =>
            HttpResponse.json({ content: mockedReceipt }, { status: 201 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(expectedReceipt)
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/receipts`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.create({} as any)

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns conflict on 409', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/receipts`,
            () => new HttpResponse(null, { status: 409 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.create({
          keyLoanId: '00000000-0000-0000-0000-000000000001',
          receiptType: 'LOAN',
        })

        expect(result).toEqual({ ok: false, err: 'conflict' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/receipts`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.create({
          keyLoanId: '00000000-0000-0000-0000-000000000001',
          receiptType: 'LOAN',
        })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.ReceiptsApi.get, () => {
      it('returns ok with receipt on 200', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/receipts/:id`, () =>
            HttpResponse.json({ content: mockedReceipt }, { status: 200 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(expectedReceipt)
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/receipts/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/receipts/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.ReceiptsApi.getByKeyLoan, () => {
      it('returns ok with receipts array on 200', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/receipts/by-key-loan/:keyLoanId`,
            () =>
              HttpResponse.json({ content: [mockedReceipt] }, { status: 200 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.getByKeyLoan(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual([expectedReceipt])
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/receipts/by-key-loan/:keyLoanId`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.getByKeyLoan(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.ReceiptsApi.update, () => {
      it('returns ok with updated receipt on 200', async () => {
        const updatePayload = { fileId: 'new-file-id' }
        const updatedReceipt = { ...mockedReceipt, fileId: 'new-file-id' }

        mockServer.use(
          http.put(`${config.keysService.url}/receipts/:id`, () =>
            HttpResponse.json({ content: updatedReceipt }, { status: 200 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.update(
          '00000000-0000-0000-0000-000000000001',
          updatePayload
        )

        assert(result.ok)
        expect(result.data).toEqual(ReceiptSchema.parse(updatedReceipt))
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/receipts/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.update(
          '00000000-0000-0000-0000-000000000999',
          { fileId: 'test' }
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/receipts/:id`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { fileId: '' }
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/receipts/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { fileId: 'test' }
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.ReceiptsApi.remove, () => {
      it('returns ok on 200', async () => {
        mockServer.use(
          http.delete(`${config.keysService.url}/receipts/:id`, () =>
            HttpResponse.json(undefined, { status: 200 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.delete(
            `${config.keysService.url}/receipts/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.remove(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.delete(
            `${config.keysService.url}/receipts/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.ReceiptsApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })
  })

  // ============================================================================
  // KeyNotesApi Tests
  // ============================================================================

  describe('KeyNotesApi', () => {
    describe(keysAdapter.KeyNotesApi.getByRentalObjectCode, () => {
      it('returns ok with key notes array on 200', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-notes/by-rental-object/:rentalObjectCode`,
            () =>
              HttpResponse.json({ content: [mockedKeyNote] }, { status: 200 })
          )
        )

        const result =
          await keysAdapter.KeyNotesApi.getByRentalObjectCode('123-456-789/1')

        assert(result.ok)
        expect(result.data).toEqual([mockedKeyNote])
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-notes/by-rental-object/:rentalObjectCode`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result =
          await keysAdapter.KeyNotesApi.getByRentalObjectCode('123-456-789/1')

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyNotesApi.get, () => {
      it('returns ok with key note on 200', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/key-notes/:id`, () =>
            HttpResponse.json({ content: mockedKeyNote }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeyNotesApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(mockedKeyNote)
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-notes/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.KeyNotesApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-notes/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeyNotesApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyNotesApi.create, () => {
      it('returns ok with created key note on 201', async () => {
        const createPayload = {
          rentalObjectCode: '123-456-789/1',
          description: 'Test note',
        }

        mockServer.use(
          http.post(`${config.keysService.url}/key-notes`, () =>
            HttpResponse.json({ content: mockedKeyNote }, { status: 201 })
          )
        )

        const result = await keysAdapter.KeyNotesApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(mockedKeyNote)
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/key-notes`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.KeyNotesApi.create({})

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/key-notes`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeyNotesApi.create({
          rentalObjectCode: '123-456-789/1',
          description: 'Test',
        })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyNotesApi.update, () => {
      it('returns ok with updated key note on 200', async () => {
        const updatePayload = { description: 'Updated note' }
        const updatedNote = { ...mockedKeyNote, description: 'Updated note' }

        mockServer.use(
          http.put(`${config.keysService.url}/key-notes/:id`, () =>
            HttpResponse.json({ content: updatedNote }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeyNotesApi.update(
          '00000000-0000-0000-0000-000000000001',
          updatePayload
        )

        assert(result.ok)
        expect(result.data).toEqual(updatedNote)
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/key-notes/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.KeyNotesApi.update(
          '00000000-0000-0000-0000-000000000999',
          { description: 'Test' }
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/key-notes/:id`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.KeyNotesApi.update(
          '00000000-0000-0000-0000-000000000001',
          { description: '' }
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/key-notes/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeyNotesApi.update(
          '00000000-0000-0000-0000-000000000001',
          { description: 'Test' }
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })
  })

  // ============================================================================
  // KeyEventsApi Tests
  // ============================================================================

  describe('KeyEventsApi', () => {
    describe(keysAdapter.KeyEventsApi.list, () => {
      it('returns ok with key events array on 200', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/key-events`, () =>
            HttpResponse.json({ content: [mockedKeyEvent] }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.list()

        assert(result.ok)
        expect(result.data).toEqual([expectedKeyEvent])
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-events`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.list()

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyEventsApi.getByKey, () => {
      it('returns ok with key events for specific key on 200', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/key-events/by-key/:keyId`, () =>
            HttpResponse.json({ content: [mockedKeyEvent] }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.getByKey(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual([expectedKeyEvent])
      })

      it('returns ok with limit parameter', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/key-events/by-key/:keyId`, () =>
            HttpResponse.json({ content: [mockedKeyEvent] }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.getByKey(
          '00000000-0000-0000-0000-000000000001',
          5
        )

        assert(result.ok)
        expect(result.data).toEqual([expectedKeyEvent])
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-events/by-key/:keyId`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.getByKey(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyEventsApi.get, () => {
      it('returns ok with key event on 200', async () => {
        mockServer.use(
          http.get(`${config.keysService.url}/key-events/:id`, () =>
            HttpResponse.json({ content: mockedKeyEvent }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(expectedKeyEvent)
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-events/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.get(
            `${config.keysService.url}/key-events/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyEventsApi.create, () => {
      it('returns ok with created key event on 201', async () => {
        const createPayload = {
          keys: ['key-1'],
          type: 'FLEX' as const,
          status: 'ORDERED' as const,
        }

        mockServer.use(
          http.post(`${config.keysService.url}/key-events`, () =>
            HttpResponse.json({ content: mockedKeyEvent }, { status: 201 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(expectedKeyEvent)
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/key-events`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.create({} as any)

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns conflict on 409', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/key-events`,
            () => new HttpResponse(null, { status: 409 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.create({
          keys: ['key-1'],
          type: 'FLEX',
          status: 'ORDERED',
        })

        expect(result).toEqual({ ok: false, err: 'conflict' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.post(
            `${config.keysService.url}/key-events`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.create({
          keys: ['key-1'],
          type: 'FLEX',
          status: 'ORDERED',
        })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyEventsApi.update, () => {
      it('returns ok with updated key event on 200', async () => {
        const updatePayload = { status: 'COMPLETED' as const }
        const updatedEvent = { ...mockedKeyEvent, status: 'COMPLETED' }

        mockServer.use(
          http.put(`${config.keysService.url}/key-events/:id`, () =>
            HttpResponse.json({ content: updatedEvent }, { status: 200 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.update(
          '00000000-0000-0000-0000-000000000001',
          updatePayload
        )

        assert(result.ok)
        expect(result.data).toEqual(KeyEventSchema.parse(updatedEvent))
      })

      it('returns not-found on 404', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/key-events/:id`,
            () => new HttpResponse(null, { status: 404 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.update(
          '00000000-0000-0000-0000-000000000999',
          { status: 'COMPLETED' }
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns bad-request on 400', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/key-events/:id`,
            () => new HttpResponse(null, { status: 400 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { status: 'INVALID' as any }
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        mockServer.use(
          http.put(
            `${config.keysService.url}/key-events/:id`,
            () => new HttpResponse(null, { status: 500 })
          )
        )

        const result = await keysAdapter.KeyEventsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { status: 'COMPLETED' }
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })
  })
})
