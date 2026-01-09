import { Readable } from 'stream'
import { BucketItem, BucketItemStat } from 'minio'
import * as minioAdapter from '../../adapters/minio-adapter'

// Mock the minio client
jest.mock('minio', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      bucketExists: jest.fn(),
      makeBucket: jest.fn(),
      putObject: jest.fn(),
      getObject: jest.fn(),
      removeObject: jest.fn(),
      statObject: jest.fn(),
      presignedGetObject: jest.fn(),
      listObjectsV2: jest.fn(),
    })),
  }
})

describe('minio-adapter', () => {
  let mockMinioClient: any

  beforeEach(() => {
    // Get the mocked client instance
    mockMinioClient = minioAdapter.minioClient
    jest.clearAllMocks()
  })

  describe('initializeBucket', () => {
    it('should create bucket if it does not exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false)
      mockMinioClient.makeBucket.mockResolvedValue(undefined)

      await minioAdapter.initializeBucket()

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith(
        'onecore-documents'
      )
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith(
        'onecore-documents',
        'us-east-1'
      )
    })

    it('should not create bucket if it already exists', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true)

      await minioAdapter.initializeBucket()

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith(
        'onecore-documents'
      )
      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled()
    })

    it('should throw error if bucket initialization fails', async () => {
      const error = new Error('Failed to create bucket')
      mockMinioClient.bucketExists.mockRejectedValue(error)

      await expect(minioAdapter.initializeBucket()).rejects.toThrow(
        'Failed to create bucket'
      )
    })
  })

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const fileName = 'test-file.txt'
      const fileBuffer = Buffer.from('test content')
      const contentType = 'text/plain'

      mockMinioClient.putObject.mockResolvedValue(undefined)

      const result = await minioAdapter.uploadFile(
        fileName,
        fileBuffer,
        contentType
      )

      expect(result).toBe(fileName)
      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'onecore-documents',
        fileName,
        fileBuffer,
        fileBuffer.length,
        { 'Content-Type': contentType }
      )
    })

    it('should throw error if upload fails', async () => {
      const error = new Error('Upload failed')
      mockMinioClient.putObject.mockRejectedValue(error)

      await expect(
        minioAdapter.uploadFile('test.txt', Buffer.from('test'), 'text/plain')
      ).rejects.toThrow('Upload failed')
    })
  })

  describe('getFile', () => {
    it('should retrieve file as stream', async () => {
      const fileName = 'test-file.txt'
      const mockStream = new Readable()
      mockMinioClient.getObject.mockResolvedValue(mockStream)

      const result = await minioAdapter.getFile(fileName)

      expect(result).toBe(mockStream)
      expect(mockMinioClient.getObject).toHaveBeenCalledWith(
        'onecore-documents',
        fileName
      )
    })

    it('should throw error if file retrieval fails', async () => {
      const error = new Error('File not found')
      mockMinioClient.getObject.mockRejectedValue(error)

      await expect(minioAdapter.getFile('nonexistent.txt')).rejects.toThrow(
        'File not found'
      )
    })
  })

  describe('getFileUrl', () => {
    it('should generate presigned URL with default expiry', async () => {
      const fileName = 'test-file.txt'
      const mockUrl = 'https://minio.example.com/presigned-url'
      mockMinioClient.presignedGetObject.mockResolvedValue(mockUrl)

      const result = await minioAdapter.getFileUrl(fileName)

      expect(result).toBe(mockUrl)
      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'onecore-documents',
        fileName,
        3600
      )
    })

    it('should generate presigned URL with custom expiry', async () => {
      const fileName = 'test-file.txt'
      const expirySeconds = 7200
      const mockUrl = 'https://minio.example.com/presigned-url'
      mockMinioClient.presignedGetObject.mockResolvedValue(mockUrl)

      const result = await minioAdapter.getFileUrl(fileName, expirySeconds)

      expect(result).toBe(mockUrl)
      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'onecore-documents',
        fileName,
        expirySeconds
      )
    })

    it('should throw error if URL generation fails', async () => {
      const error = new Error('URL generation failed')
      mockMinioClient.presignedGetObject.mockRejectedValue(error)

      await expect(minioAdapter.getFileUrl('test.txt')).rejects.toThrow(
        'URL generation failed'
      )
    })
  })

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const fileName = 'test-file.txt'
      mockMinioClient.removeObject.mockResolvedValue(undefined)

      await minioAdapter.deleteFile(fileName)

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'onecore-documents',
        fileName
      )
    })

    it('should throw error if deletion fails', async () => {
      const error = new Error('Deletion failed')
      mockMinioClient.removeObject.mockRejectedValue(error)

      await expect(minioAdapter.deleteFile('test.txt')).rejects.toThrow(
        'Deletion failed'
      )
    })
  })

  describe('getFileMetadata', () => {
    it('should retrieve file metadata successfully', async () => {
      const fileName = 'test-file.txt'
      const mockStat: BucketItemStat = {
        size: 1024,
        etag: 'abc123',
        lastModified: new Date(),
        metaData: {},
      }
      mockMinioClient.statObject.mockResolvedValue(mockStat)

      const result = await minioAdapter.getFileMetadata(fileName)

      expect(result).toBe(mockStat)
      expect(mockMinioClient.statObject).toHaveBeenCalledWith(
        'onecore-documents',
        fileName
      )
    })

    it('should throw error if metadata retrieval fails', async () => {
      const error = new Error('Metadata retrieval failed')
      mockMinioClient.statObject.mockRejectedValue(error)

      await expect(minioAdapter.getFileMetadata('test.txt')).rejects.toThrow(
        'Metadata retrieval failed'
      )
    })
  })

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const fileName = 'test-file.txt'
      mockMinioClient.statObject.mockResolvedValue({})

      const result = await minioAdapter.fileExists(fileName)

      expect(result).toBe(true)
      expect(mockMinioClient.statObject).toHaveBeenCalledWith(
        'onecore-documents',
        fileName
      )
    })

    it('should return false if file does not exist', async () => {
      const fileName = 'nonexistent.txt'
      mockMinioClient.statObject.mockRejectedValue(new Error('Not found'))

      const result = await minioAdapter.fileExists(fileName)

      expect(result).toBe(false)
    })
  })

  describe('listFiles', () => {
    it('should list files with given prefix', async () => {
      const prefix = 'documents/'
      const mockFiles: BucketItem[] = [
        {
          name: 'documents/file1.txt',
          size: 100,
          etag: 'abc123',
          lastModified: new Date(),
        },
        {
          name: 'documents/file2.txt',
          size: 200,
          etag: 'def456',
          lastModified: new Date(),
        },
      ]

      const mockStream = new Readable({
        objectMode: true,
        read() {
          mockFiles.forEach((file) => this.push(file))
          this.push(null)
        },
      })

      mockMinioClient.listObjectsV2.mockReturnValue(mockStream)

      const result = await minioAdapter.listFiles(prefix)

      expect(result).toEqual(mockFiles)
      expect(mockMinioClient.listObjectsV2).toHaveBeenCalledWith(
        'onecore-documents',
        prefix,
        true
      )
    })

    it('should return empty array if no files found', async () => {
      const prefix = 'empty/'
      const mockStream = new Readable({
        objectMode: true,
        read() {
          this.push(null)
        },
      })

      mockMinioClient.listObjectsV2.mockReturnValue(mockStream)

      const result = await minioAdapter.listFiles(prefix)

      expect(result).toEqual([])
    })

    it('should handle stream errors', async () => {
      const prefix = 'error/'
      const mockStream = new Readable({
        objectMode: true,
        read() {
          this.emit('error', new Error('Stream error'))
        },
      })

      mockMinioClient.listObjectsV2.mockReturnValue(mockStream)

      await expect(minioAdapter.listFiles(prefix)).rejects.toThrow(
        'Stream error'
      )
    })
  })
})
