import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { Readable } from 'stream'
import * as minioAdapter from '../../adapters/minio-adapter'
import { routes } from '../../services/file-storage-service'

// Mock the minio adapter
jest.mock('../../adapters/minio-adapter')

describe('file-storage-service routes', () => {
  let app: Koa
  const mockedMinioAdapter = minioAdapter as jest.Mocked<typeof minioAdapter>

  beforeEach(() => {
    app = new Koa()
    const router = new KoaRouter()
    routes(router)
    app.use(bodyParser())
    app.use(router.routes())
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET /files', () => {
    it('should list all files when no prefix is provided', async () => {
      const mockFiles = [
        {
          name: 'file1.txt',
          size: 100,
          etag: 'abc123',
          lastModified: new Date(),
        },
        {
          name: 'file2.txt',
          size: 200,
          etag: 'def456',
          lastModified: new Date(),
        },
      ]
      mockedMinioAdapter.listFiles.mockResolvedValue(mockFiles)

      const response = await request(app.callback()).get('/files')

      expect(response.status).toBe(200)
      expect(response.body.files).toHaveLength(2)
      expect(response.body.files[0].name).toBe('file1.txt')
      expect(response.body.files[0].size).toBe(100)
      expect(response.body.files[1].name).toBe('file2.txt')
      expect(response.body.files[1].size).toBe(200)
      expect(mockedMinioAdapter.listFiles).toHaveBeenCalledWith('')
    })

    it('should list files with prefix when provided', async () => {
      const prefix = 'documents/'
      const mockFiles = [
        {
          name: 'documents/file1.txt',
          size: 100,
          etag: 'xyz789',
          lastModified: new Date(),
        },
      ]
      mockedMinioAdapter.listFiles.mockResolvedValue(mockFiles)

      const response = await request(app.callback()).get(
        `/files?prefix=${prefix}`
      )

      expect(response.status).toBe(200)
      expect(response.body.files).toHaveLength(1)
      expect(response.body.files[0].name).toBe('documents/file1.txt')
      expect(response.body.files[0].size).toBe(100)
      expect(mockedMinioAdapter.listFiles).toHaveBeenCalledWith(prefix)
    })

    it('should return 500 if listing fails', async () => {
      mockedMinioAdapter.listFiles.mockRejectedValue(
        new Error('Failed to list files')
      )

      const response = await request(app.callback()).get('/files')

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Failed to list files')
    })
  })

  describe('POST /files/upload', () => {
    it('should upload a file successfully', async () => {
      const fileName = 'test-file.txt'
      const fileData = Buffer.from('test content').toString('base64')
      const contentType = 'text/plain'

      mockedMinioAdapter.uploadFile.mockResolvedValue(fileName)

      const response = await request(app.callback())
        .post('/files/upload')
        .send({ fileName, fileData, contentType })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        fileName,
        message: 'File uploaded successfully',
      })
      expect(mockedMinioAdapter.uploadFile).toHaveBeenCalledWith(
        fileName,
        Buffer.from(fileData, 'base64'),
        contentType
      )
    })

    it('should return 400 if fileName is missing', async () => {
      const response = await request(app.callback())
        .post('/files/upload')
        .send({ fileData: 'data', contentType: 'text/plain' })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe(
        'fileName, fileData, and contentType are required'
      )
    })

    it('should return 400 if fileData is missing', async () => {
      const response = await request(app.callback())
        .post('/files/upload')
        .send({ fileName: 'test.txt', contentType: 'text/plain' })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe(
        'fileName, fileData, and contentType are required'
      )
    })

    it('should return 400 if contentType is missing', async () => {
      const response = await request(app.callback())
        .post('/files/upload')
        .send({ fileName: 'test.txt', fileData: 'data' })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe(
        'fileName, fileData, and contentType are required'
      )
    })

    it('should return 500 if upload fails', async () => {
      mockedMinioAdapter.uploadFile.mockRejectedValue(
        new Error('Upload failed')
      )

      const response = await request(app.callback())
        .post('/files/upload')
        .send({
          fileName: 'test.txt',
          fileData: Buffer.from('test').toString('base64'),
          contentType: 'text/plain',
        })

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Failed to upload file')
    })
  })

  describe('GET /files/:fileName', () => {
    it('should download a file successfully', async () => {
      const fileName = 'test-file.txt'
      const mockStream = new Readable()
      mockStream.push('file content')
      mockStream.push(null)

      mockedMinioAdapter.fileExists.mockResolvedValue(true)
      mockedMinioAdapter.getFile.mockResolvedValue(mockStream)

      const response = await request(app.callback()).get(`/files/${fileName}`)

      expect(response.status).toBe(200)
      expect(response.header['content-type']).toBe('application/octet-stream')
      expect(response.header['content-disposition']).toBe(
        `attachment; filename="${fileName}"`
      )
    })

    it('should return 404 if file does not exist', async () => {
      mockedMinioAdapter.fileExists.mockResolvedValue(false)

      const response = await request(app.callback()).get(
        '/files/nonexistent.txt'
      )

      expect(response.status).toBe(404)
      expect(response.body.error).toBe('File not found')
      expect(mockedMinioAdapter.getFile).not.toHaveBeenCalled()
    })

    it('should return 500 if download fails', async () => {
      mockedMinioAdapter.fileExists.mockResolvedValue(true)
      mockedMinioAdapter.getFile.mockRejectedValue(new Error('Download failed'))

      const response = await request(app.callback()).get('/files/test.txt')

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Failed to download file')
    })
  })

  describe('GET /files/:fileName/url', () => {
    it('should generate presigned URL with default expiry', async () => {
      const fileName = 'test-file.txt'
      const mockUrl = 'https://minio.example.com/presigned-url'

      mockedMinioAdapter.fileExists.mockResolvedValue(true)
      mockedMinioAdapter.getFileUrl.mockResolvedValue(mockUrl)

      const response = await request(app.callback()).get(
        `/files/${fileName}/url`
      )

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        url: mockUrl,
        expiresIn: 3600,
      })
      expect(mockedMinioAdapter.getFileUrl).toHaveBeenCalledWith(fileName, 3600)
    })

    it('should generate presigned URL with custom expiry', async () => {
      const fileName = 'test-file.txt'
      const expirySeconds = 7200
      const mockUrl = 'https://minio.example.com/presigned-url'

      mockedMinioAdapter.fileExists.mockResolvedValue(true)
      mockedMinioAdapter.getFileUrl.mockResolvedValue(mockUrl)

      const response = await request(app.callback()).get(
        `/files/${fileName}/url?expirySeconds=${expirySeconds}`
      )

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        url: mockUrl,
        expiresIn: expirySeconds,
      })
      expect(mockedMinioAdapter.getFileUrl).toHaveBeenCalledWith(
        fileName,
        expirySeconds
      )
    })

    it('should return 404 if file does not exist', async () => {
      mockedMinioAdapter.fileExists.mockResolvedValue(false)

      const response = await request(app.callback()).get(
        '/files/nonexistent.txt/url'
      )

      expect(response.status).toBe(404)
      expect(response.body.error).toBe('File not found')
      expect(mockedMinioAdapter.getFileUrl).not.toHaveBeenCalled()
    })

    it('should return 500 if URL generation fails', async () => {
      mockedMinioAdapter.fileExists.mockResolvedValue(true)
      mockedMinioAdapter.getFileUrl.mockRejectedValue(
        new Error('URL generation failed')
      )

      const response = await request(app.callback()).get('/files/test.txt/url')

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Failed to generate URL')
    })
  })

  describe('GET /files/:fileName/metadata', () => {
    it('should return file metadata', async () => {
      const fileName = 'test-file.txt'
      const mockMetadata = {
        size: 1024,
        etag: 'abc123',
        lastModified: new Date('2024-01-01'),
        metaData: {},
      }

      mockedMinioAdapter.fileExists.mockResolvedValue(true)
      mockedMinioAdapter.getFileMetadata.mockResolvedValue(mockMetadata)

      const response = await request(app.callback()).get(
        `/files/${fileName}/metadata`
      )

      expect(response.status).toBe(200)
      expect(response.body.size).toBe(1024)
      expect(response.body.etag).toBe('abc123')
    })

    it('should return 404 if file does not exist', async () => {
      mockedMinioAdapter.fileExists.mockResolvedValue(false)

      const response = await request(app.callback()).get(
        '/files/nonexistent.txt/metadata'
      )

      expect(response.status).toBe(404)
      expect(response.body.error).toBe('File not found')
      expect(mockedMinioAdapter.getFileMetadata).not.toHaveBeenCalled()
    })

    it('should return 500 if metadata retrieval fails', async () => {
      mockedMinioAdapter.fileExists.mockResolvedValue(true)
      mockedMinioAdapter.getFileMetadata.mockRejectedValue(
        new Error('Metadata retrieval failed')
      )

      const response = await request(app.callback()).get(
        '/files/test.txt/metadata'
      )

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Failed to retrieve metadata')
    })
  })

  describe('DELETE /files/:fileName', () => {
    it('should delete a file successfully', async () => {
      const fileName = 'test-file.txt'

      mockedMinioAdapter.fileExists.mockResolvedValue(true)
      mockedMinioAdapter.deleteFile.mockResolvedValue(undefined)

      const response = await request(app.callback()).delete(
        `/files/${fileName}`
      )

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ message: 'File deleted successfully' })
      expect(mockedMinioAdapter.deleteFile).toHaveBeenCalledWith(fileName)
    })

    it('should return 404 if file does not exist', async () => {
      mockedMinioAdapter.fileExists.mockResolvedValue(false)

      const response = await request(app.callback()).delete(
        '/files/nonexistent.txt'
      )

      expect(response.status).toBe(404)
      expect(response.body.error).toBe('File not found')
      expect(mockedMinioAdapter.deleteFile).not.toHaveBeenCalled()
    })

    it('should return 500 if deletion fails', async () => {
      mockedMinioAdapter.fileExists.mockResolvedValue(true)
      mockedMinioAdapter.deleteFile.mockRejectedValue(
        new Error('Deletion failed')
      )

      const response = await request(app.callback()).delete('/files/test.txt')

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Failed to delete file')
    })
  })

  describe('GET /files/:fileName/exists', () => {
    it('should return true if file exists', async () => {
      const fileName = 'test-file.txt'
      mockedMinioAdapter.fileExists.mockResolvedValue(true)

      const response = await request(app.callback()).get(
        `/files/${fileName}/exists`
      )

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ exists: true })
      expect(mockedMinioAdapter.fileExists).toHaveBeenCalledWith(fileName)
    })

    it('should return false if file does not exist', async () => {
      const fileName = 'nonexistent.txt'
      mockedMinioAdapter.fileExists.mockResolvedValue(false)

      const response = await request(app.callback()).get(
        `/files/${fileName}/exists`
      )

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ exists: false })
    })

    it('should return 500 if existence check fails', async () => {
      mockedMinioAdapter.fileExists.mockRejectedValue(new Error('Check failed'))

      const response = await request(app.callback()).get(
        '/files/test.txt/exists'
      )

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Failed to check file existence')
    })
  })
})
