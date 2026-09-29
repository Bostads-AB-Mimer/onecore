import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import request from 'supertest'

import type { FileListItem } from '@onecore/types'

import * as fileStorageAdapter from '../../../adapters/file-storage-adapter'
import { routes } from '../index'

const file = (name: string): FileListItem => ({
  name,
  lastModified: new Date(0).toISOString(),
  etag: 'etag',
  size: 1,
})

jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  generateRouteMetadata: jest.fn(() => ({})),
}))

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('guide files are not reachable through /files', () => {
  it('refuses to delete a guide image', async () => {
    const deleteSpy = jest.spyOn(fileStorageAdapter, 'deleteFile')

    const res = await request(app.callback()).delete(
      `/files/${encodeURIComponent('guide/abc/1.png')}`
    )

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('guide-files-managed-via-guides-api')
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('refuses to delete a guide image addressed with leading slashes', async () => {
    const deleteSpy = jest.spyOn(fileStorageAdapter, 'deleteFile')

    const res = await request(app.callback()).delete(
      `/files/${encodeURIComponent('//guide/abc/1.png')}`
    )

    expect(res.status).toBe(403)
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('refuses to upload to a guide image key', async () => {
    const uploadSpy = jest.spyOn(fileStorageAdapter, 'uploadFile')

    const res = await request(app.callback())
      .post('/files/upload')
      .send({
        fileName: 'guide/abc/1.png',
        fileData: Buffer.from('x').toString('base64'),
        contentType: 'image/png',
      })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('guide-files-managed-via-guides-api')
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('refuses to upload to a guide image key with a leading slash', async () => {
    const uploadSpy = jest.spyOn(fileStorageAdapter, 'uploadFile')

    const res = await request(app.callback())
      .post('/files/upload')
      .send({
        fileName: '/guide/abc/1.png',
        fileData: Buffer.from('x').toString('base64'),
        contentType: 'image/png',
      })

    expect(res.status).toBe(403)
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('still uploads files under other keys', async () => {
    const uploadSpy = jest
      .spyOn(fileStorageAdapter, 'uploadFile')
      .mockResolvedValue({
        ok: true,
        data: { fileName: 'inspection/1.pdf', message: 'uploaded' },
      })

    const res = await request(app.callback())
      .post('/files/upload')
      .send({
        fileName: 'inspection/1.pdf',
        fileData: Buffer.from('x').toString('base64'),
        contentType: 'application/pdf',
      })

    expect(res.status).toBe(200)
    expect(uploadSpy).toHaveBeenCalledWith(
      'inspection/1.pdf',
      Buffer.from('x'),
      'application/pdf'
    )
  })

  it('refuses to list files under the guide prefix', async () => {
    const listSpy = jest.spyOn(fileStorageAdapter, 'listFiles')

    const res = await request(app.callback()).get('/files?prefix=guide/abc')

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('guide-files-managed-via-guides-api')
    expect(listSpy).not.toHaveBeenCalled()
  })

  it('still lists files under other prefixes', async () => {
    const listSpy = jest
      .spyOn(fileStorageAdapter, 'listFiles')
      .mockResolvedValue({ ok: true, data: [file('inspection/1.pdf')] })

    const res = await request(app.callback()).get('/files?prefix=inspection/')

    expect(res.status).toBe(200)
    expect(listSpy).toHaveBeenCalledWith('inspection/')
    expect(res.body.content.files.map((f: FileListItem) => f.name)).toEqual([
      'inspection/1.pdf',
    ])
  })

  it('omits guide images from a listing without a prefix', async () => {
    jest.spyOn(fileStorageAdapter, 'listFiles').mockResolvedValue({
      ok: true,
      data: [file('guide/abc/1.png'), file('inspection/1.pdf')],
    })

    const res = await request(app.callback()).get('/files')

    expect(res.status).toBe(200)
    expect(res.body.content.files.map((f: FileListItem) => f.name)).toEqual([
      'inspection/1.pdf',
    ])
  })

  it('omits guide images from a listing with a partial prefix', async () => {
    jest.spyOn(fileStorageAdapter, 'listFiles').mockResolvedValue({
      ok: true,
      data: [file('guide/abc/1.png'), file('gallery/1.png')],
    })

    const res = await request(app.callback()).get('/files?prefix=g')

    expect(res.status).toBe(200)
    expect(res.body.content.files.map((f: FileListItem) => f.name)).toEqual([
      'gallery/1.png',
    ])
  })

  it.each([
    ['url', 'getFileUrl'],
    ['metadata', 'getFileMetadata'],
    ['exists', 'fileExists'],
  ] as const)(
    'refuses GET /files/:fileName/%s for a guide image',
    async (route, adapterFn) => {
      const spy = jest.spyOn(fileStorageAdapter, adapterFn)

      const res = await request(app.callback()).get(
        `/files/${encodeURIComponent('guide/abc/1.png')}/${route}`
      )

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('guide-files-managed-via-guides-api')
      expect(spy).not.toHaveBeenCalled()
    }
  )

  it('still returns a presigned url for other keys', async () => {
    const spy = jest.spyOn(fileStorageAdapter, 'getFileUrl').mockResolvedValue({
      ok: true,
      data: { url: 'https://storage/inspection/1.pdf', expiresIn: 3600 },
    })

    const res = await request(app.callback()).get(
      `/files/${encodeURIComponent('inspection/1.pdf')}/url`
    )

    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith('inspection/1.pdf', 3600)
  })

  it.each(['\\guide/abc/1.png', 'guide\\abc\\1.png', './guide/abc/1.png'])(
    'refuses to upload to the guide key spelled %s',
    async (fileName) => {
      const uploadSpy = jest.spyOn(fileStorageAdapter, 'uploadFile')

      const res = await request(app.callback())
        .post('/files/upload')
        .send({
          fileName,
          fileData: Buffer.from('x').toString('base64'),
          contentType: 'image/png',
        })

      expect(res.status).toBe(403)
      expect(uploadSpy).not.toHaveBeenCalled()
    }
  )

  it('refuses to delete a guide image addressed with a backslash', async () => {
    const deleteSpy = jest.spyOn(fileStorageAdapter, 'deleteFile')

    const res = await request(app.callback()).delete(
      `/files/${encodeURIComponent('\\guide/abc/1.png')}`
    )

    expect(res.status).toBe(403)
    expect(deleteSpy).not.toHaveBeenCalled()
  })
})
