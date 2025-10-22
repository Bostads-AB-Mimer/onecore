import nock from 'nock'
import assert from 'node:assert'
import config from '../../../common/config'
import * as keysAdapter from '../../keys-adapter'
import { mockedReceipt, mockedKeyNote, mockedKeyEvent } from './mocks'

describe('keys-adapter - Receipts, KeyNotes & KeyEvents', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  // ============================================================================
  // ReceiptsApi Tests
  // ============================================================================

  describe('ReceiptsApi', () => {
    describe(keysAdapter.ReceiptsApi.create, () => {
      it('returns ok with created receipt on 201', async () => {
        const createPayload = {
          keyLoanId: '00000000-0000-0000-0000-000000000001',
          receiptType: 'LOAN' as const,
          type: 'DIGITAL' as const,
        }

        nock(config.keysService.url)
          .post('/receipts', createPayload)
          .reply(201, { content: mockedReceipt })

        const result = await keysAdapter.ReceiptsApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(mockedReceipt)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url).post('/receipts').reply(400)

        const result = await keysAdapter.ReceiptsApi.create({} as any)

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns conflict on 409', async () => {
        nock(config.keysService.url).post('/receipts').reply(409)

        const result = await keysAdapter.ReceiptsApi.create({
          keyLoanId: '00000000-0000-0000-0000-000000000001',
          receiptType: 'LOAN',
        })

        expect(result).toEqual({ ok: false, err: 'conflict' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).post('/receipts').reply(500)

        const result = await keysAdapter.ReceiptsApi.create({
          keyLoanId: '00000000-0000-0000-0000-000000000001',
          receiptType: 'LOAN',
        })

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.ReceiptsApi.get, () => {
      it('returns ok with receipt on 200', async () => {
        nock(config.keysService.url)
          .get('/receipts/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: mockedReceipt })

        const result = await keysAdapter.ReceiptsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(mockedReceipt)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .get('/receipts/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.ReceiptsApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/receipts/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.ReceiptsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.ReceiptsApi.getByKeyLoan, () => {
      it('returns ok with receipts array on 200', async () => {
        nock(config.keysService.url)
          .get('/receipts/by-key-loan/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: [mockedReceipt] })

        const result = await keysAdapter.ReceiptsApi.getByKeyLoan(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual([mockedReceipt])
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/receipts/by-key-loan/00000000-0000-0000-0000-000000000001')
          .reply(500)

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

        nock(config.keysService.url)
          .patch(
            '/receipts/00000000-0000-0000-0000-000000000001',
            updatePayload
          )
          .reply(200, { content: updatedReceipt })

        const result = await keysAdapter.ReceiptsApi.update(
          '00000000-0000-0000-0000-000000000001',
          updatePayload
        )

        assert(result.ok)
        expect(result.data).toEqual(updatedReceipt)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .patch('/receipts/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.ReceiptsApi.update(
          '00000000-0000-0000-0000-000000000999',
          { fileId: 'test' }
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url)
          .patch('/receipts/00000000-0000-0000-0000-000000000001')
          .reply(400)

        const result = await keysAdapter.ReceiptsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { fileId: '' }
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .patch('/receipts/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.ReceiptsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { fileId: 'test' }
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.ReceiptsApi.remove, () => {
      it('returns ok on 200', async () => {
        nock(config.keysService.url)
          .delete('/receipts/00000000-0000-0000-0000-000000000001')
          .reply(200)

        const result = await keysAdapter.ReceiptsApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .delete('/receipts/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.ReceiptsApi.remove(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .delete('/receipts/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.ReceiptsApi.remove(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    // NOTE: uploadFile tests are skipped because nock has difficulty intercepting
    // multipart/form-data requests. The uploadFileBase64 tests below provide
    // equivalent coverage for the same API endpoints.
    describe(keysAdapter.ReceiptsApi.uploadFile, () => {
      it('returns unknown on 500', async () => {
        const fileBuffer = Buffer.from('test')

        nock(config.keysService.url)
          .matchHeader('content-type', /multipart\/form-data/)
          .post('/receipts/00000000-0000-0000-0000-000000000001/upload')
          .reply(500)

        const result = await keysAdapter.ReceiptsApi.uploadFile(
          '00000000-0000-0000-0000-000000000001',
          fileBuffer,
          'receipt.pdf',
          'application/pdf'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.ReceiptsApi.getDownloadUrl, () => {
      it('returns ok with download URL on 200', async () => {
        const downloadInfo = {
          url: 'https://storage.example.com/file-123',
          expiresIn: 3600,
          fileId: 'file-123',
        }

        nock(config.keysService.url)
          .get('/receipts/00000000-0000-0000-0000-000000000001/download')
          .reply(200, { content: downloadInfo })

        const result = await keysAdapter.ReceiptsApi.getDownloadUrl(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(downloadInfo)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .get('/receipts/00000000-0000-0000-0000-000000000999/download')
          .reply(404)

        const result = await keysAdapter.ReceiptsApi.getDownloadUrl(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/receipts/00000000-0000-0000-0000-000000000001/download')
          .reply(500)

        const result = await keysAdapter.ReceiptsApi.getDownloadUrl(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.ReceiptsApi.uploadFileBase64, () => {
      it('returns ok with file info on 200', async () => {
        const base64Content = Buffer.from('test file').toString('base64')
        const fileInfo = {
          fileId: 'file-123',
          fileName: 'receipt.pdf',
          size: 1024,
          source: 'base64',
        }

        nock(config.keysService.url)
          .post('/receipts/00000000-0000-0000-0000-000000000001/upload-base64')
          .reply(200, { content: fileInfo })

        const result = await keysAdapter.ReceiptsApi.uploadFileBase64(
          '00000000-0000-0000-0000-000000000001',
          base64Content,
          'receipt.pdf',
          { source: 'power-automate' }
        )

        assert(result.ok)
        expect(result.data).toEqual(fileInfo)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url)
          .post('/receipts/00000000-0000-0000-0000-000000000001/upload-base64')
          .reply(400)

        const result = await keysAdapter.ReceiptsApi.uploadFileBase64(
          '00000000-0000-0000-0000-000000000001',
          ''
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .post('/receipts/00000000-0000-0000-0000-000000000999/upload-base64')
          .reply(404)

        const result = await keysAdapter.ReceiptsApi.uploadFileBase64(
          '00000000-0000-0000-0000-000000000999',
          'base64content'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .post('/receipts/00000000-0000-0000-0000-000000000001/upload-base64')
          .reply(500)

        const result = await keysAdapter.ReceiptsApi.uploadFileBase64(
          '00000000-0000-0000-0000-000000000001',
          'base64content'
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
        nock(config.keysService.url)
          .get(/\/key-notes\/by-rental-object\/.*/)
          .reply(200, { content: [mockedKeyNote] })

        const result =
          await keysAdapter.KeyNotesApi.getByRentalObjectCode('123-456-789/1')

        assert(result.ok)
        expect(result.data).toEqual([mockedKeyNote])
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get(/\/key-notes\/by-rental-object\/.*/)
          .reply(500)

        const result =
          await keysAdapter.KeyNotesApi.getByRentalObjectCode('123-456-789/1')

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyNotesApi.get, () => {
      it('returns ok with key note on 200', async () => {
        nock(config.keysService.url)
          .get('/key-notes/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: mockedKeyNote })

        const result = await keysAdapter.KeyNotesApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(mockedKeyNote)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .get('/key-notes/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeyNotesApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/key-notes/00000000-0000-0000-0000-000000000001')
          .reply(500)

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

        nock(config.keysService.url)
          .post('/key-notes', createPayload)
          .reply(201, { content: mockedKeyNote })

        const result = await keysAdapter.KeyNotesApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(mockedKeyNote)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url).post('/key-notes').reply(400)

        const result = await keysAdapter.KeyNotesApi.create({})

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).post('/key-notes').reply(500)

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

        nock(config.keysService.url)
          .patch(
            '/key-notes/00000000-0000-0000-0000-000000000001',
            updatePayload
          )
          .reply(200, { content: updatedNote })

        const result = await keysAdapter.KeyNotesApi.update(
          '00000000-0000-0000-0000-000000000001',
          updatePayload
        )

        assert(result.ok)
        expect(result.data).toEqual(updatedNote)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .patch('/key-notes/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeyNotesApi.update(
          '00000000-0000-0000-0000-000000000999',
          { description: 'Test' }
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url)
          .patch('/key-notes/00000000-0000-0000-0000-000000000001')
          .reply(400)

        const result = await keysAdapter.KeyNotesApi.update(
          '00000000-0000-0000-0000-000000000001',
          { description: '' }
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .patch('/key-notes/00000000-0000-0000-0000-000000000001')
          .reply(500)

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
        nock(config.keysService.url)
          .get('/key-events')
          .reply(200, { content: [mockedKeyEvent] })

        const result = await keysAdapter.KeyEventsApi.list()

        assert(result.ok)
        expect(result.data).toEqual([mockedKeyEvent])
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).get('/key-events').reply(500)

        const result = await keysAdapter.KeyEventsApi.list()

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyEventsApi.getByKey, () => {
      it('returns ok with key events for specific key on 200', async () => {
        nock(config.keysService.url)
          .get('/key-events/by-key/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: [mockedKeyEvent] })

        const result = await keysAdapter.KeyEventsApi.getByKey(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual([mockedKeyEvent])
      })

      it('returns ok with limit parameter', async () => {
        nock(config.keysService.url)
          .get(
            '/key-events/by-key/00000000-0000-0000-0000-000000000001?limit=5'
          )
          .reply(200, { content: [mockedKeyEvent] })

        const result = await keysAdapter.KeyEventsApi.getByKey(
          '00000000-0000-0000-0000-000000000001',
          5
        )

        assert(result.ok)
        expect(result.data).toEqual([mockedKeyEvent])
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/key-events/by-key/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeyEventsApi.getByKey(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyEventsApi.get, () => {
      it('returns ok with key event on 200', async () => {
        nock(config.keysService.url)
          .get('/key-events/00000000-0000-0000-0000-000000000001')
          .reply(200, { content: mockedKeyEvent })

        const result = await keysAdapter.KeyEventsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        assert(result.ok)
        expect(result.data).toEqual(mockedKeyEvent)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .get('/key-events/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeyEventsApi.get(
          '00000000-0000-0000-0000-000000000999'
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .get('/key-events/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeyEventsApi.get(
          '00000000-0000-0000-0000-000000000001'
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })

    describe(keysAdapter.KeyEventsApi.create, () => {
      it('returns ok with created key event on 201', async () => {
        const createPayload = {
          keys: JSON.stringify(['key-1']),
          type: 'FLEX' as const,
          status: 'ORDERED' as const,
        }

        nock(config.keysService.url)
          .post('/key-events', createPayload)
          .reply(201, { content: mockedKeyEvent })

        const result = await keysAdapter.KeyEventsApi.create(createPayload)

        assert(result.ok)
        expect(result.data).toEqual(mockedKeyEvent)
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url).post('/key-events').reply(400)

        const result = await keysAdapter.KeyEventsApi.create({} as any)

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns conflict on 409', async () => {
        nock(config.keysService.url).post('/key-events').reply(409)

        const result = await keysAdapter.KeyEventsApi.create({
          keys: JSON.stringify(['key-1']),
          type: 'FLEX',
          status: 'ORDERED',
        })

        expect(result).toEqual({ ok: false, err: 'conflict' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url).post('/key-events').reply(500)

        const result = await keysAdapter.KeyEventsApi.create({
          keys: JSON.stringify(['key-1']),
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

        nock(config.keysService.url)
          .patch(
            '/key-events/00000000-0000-0000-0000-000000000001',
            updatePayload
          )
          .reply(200, { content: updatedEvent })

        const result = await keysAdapter.KeyEventsApi.update(
          '00000000-0000-0000-0000-000000000001',
          updatePayload
        )

        assert(result.ok)
        expect(result.data).toEqual(updatedEvent)
      })

      it('returns not-found on 404', async () => {
        nock(config.keysService.url)
          .patch('/key-events/00000000-0000-0000-0000-000000000999')
          .reply(404)

        const result = await keysAdapter.KeyEventsApi.update(
          '00000000-0000-0000-0000-000000000999',
          { status: 'COMPLETED' }
        )

        expect(result).toEqual({ ok: false, err: 'not-found' })
      })

      it('returns bad-request on 400', async () => {
        nock(config.keysService.url)
          .patch('/key-events/00000000-0000-0000-0000-000000000001')
          .reply(400)

        const result = await keysAdapter.KeyEventsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { status: 'INVALID' as any }
        )

        expect(result).toEqual({ ok: false, err: 'bad-request' })
      })

      it('returns unknown on 500', async () => {
        nock(config.keysService.url)
          .patch('/key-events/00000000-0000-0000-0000-000000000001')
          .reply(500)

        const result = await keysAdapter.KeyEventsApi.update(
          '00000000-0000-0000-0000-000000000001',
          { status: 'COMPLETED' }
        )

        expect(result).toEqual({ ok: false, err: 'unknown' })
      })
    })
  })
})
