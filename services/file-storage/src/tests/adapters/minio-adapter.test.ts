import { Readable } from 'stream'
import { BucketItem, BucketItemStat } from 'minio'
import * as minioAdapter from '../../adapters/minio-adapter'
import minioConfig from '../../config/minio'

// Mock the minio client
jest.mock('minio', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      bucketExists: jest.fn(),
      makeBucket: jest.fn(),
      setBucketPolicy: jest.fn(),
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

  describe('initializePublicBucket', () => {
    it('should create the public bucket and apply the anonymous read policy when bucket is missing', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false)
      mockMinioClient.makeBucket.mockResolvedValue(undefined)
      mockMinioClient.setBucketPolicy.mockResolvedValue(undefined)

      await minioAdapter.initializePublicBucket()

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith(
        'onecore-public'
      )
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith(
        'onecore-public',
        'us-east-1'
      )
      expect(mockMinioClient.setBucketPolicy).toHaveBeenCalledWith(
        'onecore-public',
        expect.any(String)
      )

      const policyJson = mockMinioClient.setBucketPolicy.mock.calls[0][1]
      const policy = JSON.parse(policyJson)
      expect(policy.Statement[0].Principal.AWS).toContain('*')
      expect(policy.Statement[0].Action).toContain('s3:GetObject')
      expect(policy.Statement[0].Resource).toContain(
        'arn:aws:s3:::onecore-public/*'
      )
    })

    it('should not re-apply the policy when the bucket already exists', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true)

      await minioAdapter.initializePublicBucket()

      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled()
      expect(mockMinioClient.setBucketPolicy).not.toHaveBeenCalled()
    })

    it('should throw if bucket creation fails', async () => {
      const error = new Error('Failed to create bucket')
      mockMinioClient.bucketExists.mockRejectedValue(error)

      await expect(minioAdapter.initializePublicBucket()).rejects.toThrow(
        'Failed to create bucket'
      )
    })

    it('should throw if policy application fails during creation', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false)
      mockMinioClient.makeBucket.mockResolvedValue(undefined)
      mockMinioClient.setBucketPolicy.mockRejectedValue(
        new Error('Policy failed')
      )

      await expect(minioAdapter.initializePublicBucket()).rejects.toThrow(
        'Policy failed'
      )
    })
  })

  describe('uploadPublicFile', () => {
    it('should upload to the public bucket with long-lived Cache-Control metadata', async () => {
      const key = 'bofaktablad/000-000-00-0000.jpg'
      const fileBuffer = Buffer.from('image bytes')
      const contentType = 'image/jpeg'
      mockMinioClient.putObject.mockResolvedValue(undefined)

      const result = await minioAdapter.uploadPublicFile(
        key,
        fileBuffer,
        contentType
      )

      expect(result).toBe(key)
      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'onecore-public',
        key,
        fileBuffer,
        fileBuffer.length,
        {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
        }
      )
    })

    it('should throw if upload fails', async () => {
      mockMinioClient.putObject.mockRejectedValue(new Error('Upload failed'))

      await expect(
        minioAdapter.uploadPublicFile('foo.jpg', Buffer.from('x'), 'image/jpeg')
      ).rejects.toThrow('Upload failed')
    })
  })

  describe('publicFileExists', () => {
    it('should return true if the public object exists', async () => {
      mockMinioClient.statObject.mockResolvedValue({})

      const result = await minioAdapter.publicFileExists('bofaktablad/x.jpg')

      expect(result).toBe(true)
      expect(mockMinioClient.statObject).toHaveBeenCalledWith(
        'onecore-public',
        'bofaktablad/x.jpg'
      )
    })

    it('should return false if the public object does not exist', async () => {
      mockMinioClient.statObject.mockRejectedValue(new Error('not found'))

      const result = await minioAdapter.publicFileExists('nope.jpg')

      expect(result).toBe(false)
    })
  })

  describe('getPublicFileUrl', () => {
    // replaceProperty mutations leak across tests unless restored explicitly
    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('returns an http URL with explicit port when useSSL is false and port is non-default', () => {
      // defaults: endpoint=localhost, port=9000, useSSL=false
      expect(minioAdapter.getPublicFileUrl('bofaktablad/x.jpg')).toBe(
        'http://localhost:9000/onecore-public/bofaktablad/x.jpg'
      )
    })

    it('omits the port when it matches the HTTP default (80)', () => {
      jest.replaceProperty(minioConfig, 'port', 80)
      expect(minioAdapter.getPublicFileUrl('foo.jpg')).toBe(
        'http://localhost/onecore-public/foo.jpg'
      )
    })

    it('returns an https URL and omits the port when useSSL is true and port is 443', () => {
      jest.replaceProperty(minioConfig, 'useSSL', true)
      jest.replaceProperty(minioConfig, 'port', 443)
      expect(minioAdapter.getPublicFileUrl('foo.jpg')).toBe(
        'https://localhost/onecore-public/foo.jpg'
      )
    })

    it('keeps the explicit port when useSSL is true but port is non-default', () => {
      jest.replaceProperty(minioConfig, 'useSSL', true)
      jest.replaceProperty(minioConfig, 'port', 8443)
      expect(minioAdapter.getPublicFileUrl('foo.jpg')).toBe(
        'https://localhost:8443/onecore-public/foo.jpg'
      )
    })

    it('URL-encodes path segments while preserving slashes', () => {
      expect(minioAdapter.getPublicFileUrl('foo bar/baz.jpg')).toBe(
        'http://localhost:9000/onecore-public/foo%20bar/baz.jpg'
      )
    })
  })
})
