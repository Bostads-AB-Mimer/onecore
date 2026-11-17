import nock from 'nock'

import config from '../../common/config'
// Sets the process-wide axios validateStatus (< 500) that the running app has.
import '../leasing-adapter'
import * as fileStorageAdapter from '../file-storage-adapter'

describe(fileStorageAdapter.uploadFile, () => {
  afterEach(() => nock.cleanAll())

  it('returns payload_too_large when file-storage answers 413', async () => {
    nock(config.fileStorageService.url)
      .post('/files/upload')
      .reply(413, { error: 'request entity too large' })

    const result = await fileStorageAdapter.uploadFile(
      'exports/test-file.xlsx',
      Buffer.from('fake'),
      'application/octet-stream'
    )

    expect(result).toEqual({ ok: false, err: 'payload_too_large' })
  })

  it('returns bad_request when file-storage answers 400', async () => {
    nock(config.fileStorageService.url)
      .post('/files/upload')
      .reply(400, { error: 'fileName is required' })

    const result = await fileStorageAdapter.uploadFile(
      'exports/test-file.xlsx',
      Buffer.from('fake'),
      'application/octet-stream'
    )

    expect(result).toEqual({ ok: false, err: 'bad_request' })
  })

  it('returns ok with the stored file when file-storage answers 200', async () => {
    nock(config.fileStorageService.url)
      .post('/files/upload', {
        fileName: 'exports/test-file.xlsx',
        fileData: Buffer.from('fake').toString('base64'),
        contentType: 'application/octet-stream',
      })
      .reply(200, {
        fileName: 'exports/test-file.xlsx',
        message: 'File uploaded',
      })

    const result = await fileStorageAdapter.uploadFile(
      'exports/test-file.xlsx',
      Buffer.from('fake'),
      'application/octet-stream'
    )

    expect(result).toEqual({
      ok: true,
      data: { fileName: 'exports/test-file.xlsx', message: 'File uploaded' },
    })
  })
})

describe(fileStorageAdapter.getFileUrl, () => {
  afterEach(() => nock.cleanAll())

  it('returns not_found when file-storage answers 404', async () => {
    nock(config.fileStorageService.url)
      .get('/files/exports%2Fmissing.xlsx/url')
      .query({ expirySeconds: '3600' })
      .reply(404, { error: 'File not found' })

    const result = await fileStorageAdapter.getFileUrl('exports/missing.xlsx')

    expect(result).toEqual({ ok: false, err: 'not_found' })
  })

  it('returns ok with the url when file-storage answers 200', async () => {
    nock(config.fileStorageService.url)
      .get('/files/exports%2Ftest-file.xlsx/url')
      .query({ expirySeconds: '600' })
      .reply(200, {
        url: 'https://files.example.test/exports/test-file.xlsx?sig=fake',
        expiresIn: 600,
      })

    const result = await fileStorageAdapter.getFileUrl(
      'exports/test-file.xlsx',
      600
    )

    expect(result).toEqual({
      ok: true,
      data: {
        url: 'https://files.example.test/exports/test-file.xlsx?sig=fake',
        expiresIn: 600,
      },
    })
  })
})
