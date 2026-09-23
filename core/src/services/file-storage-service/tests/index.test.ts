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
})
