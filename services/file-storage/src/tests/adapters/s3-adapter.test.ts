import { Readable } from 'stream'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { mockClient } from 'aws-sdk-client-mock'
import * as s3Adapter from '../../adapters/s3-adapter'

// Keep a developer's local .env from leaking into the config under test
jest.mock('dotenv/config', () => ({}))
jest.mock('@aws-sdk/s3-request-presigner')

const BUCKET = 'onecore-documents'
const s3Mock = mockClient(S3Client)
const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<
  typeof getSignedUrl
>

const notFoundError = () =>
  new NotFound({ $metadata: { httpStatusCode: 404 }, message: 'NotFound' })

const accessDeniedError = () =>
  new S3ServiceException({
    name: 'AccessDenied',
    $fault: 'client',
    $metadata: { httpStatusCode: 403 },
    message: 'Access Denied',
  })

// Mimics the SDK's Node.js response body: a Readable with the SDK stream helpers attached
const toSdkStream = (stream: Readable) =>
  Object.assign(stream, {
    transformToByteArray: async () => new Uint8Array(),
    transformToString: async () => '',
    transformToWebStream: () => {
      throw new Error('Not used by the adapter')
    },
  })

describe('s3-adapter', () => {
  beforeEach(() => {
    s3Mock.reset()
    jest.clearAllMocks()
  })

  describe('initializeBucket', () => {
    it('creates the bucket if it does not exist', async () => {
      s3Mock.on(HeadBucketCommand).rejects(notFoundError())
      s3Mock.on(CreateBucketCommand).resolves({})

      await s3Adapter.initializeBucket()

      expect(s3Mock.commandCalls(HeadBucketCommand)[0].args[0].input).toEqual({
        Bucket: BUCKET,
      })
      expect(s3Mock.commandCalls(CreateBucketCommand)[0].args[0].input).toEqual(
        { Bucket: BUCKET }
      )
    })

    it('does not create the bucket if it already exists', async () => {
      s3Mock.on(HeadBucketCommand).resolves({})

      await s3Adapter.initializeBucket()

      expect(s3Mock.commandCalls(CreateBucketCommand)).toHaveLength(0)
    })

    it('throws if the bucket check fails for another reason', async () => {
      s3Mock.on(HeadBucketCommand).rejects(accessDeniedError())

      await expect(s3Adapter.initializeBucket()).rejects.toThrow(
        'Access Denied'
      )
      expect(s3Mock.commandCalls(CreateBucketCommand)).toHaveLength(0)
    })

    it.each(['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'])(
      'succeeds if another replica created the bucket first (%s)',
      async (name) => {
        s3Mock.on(HeadBucketCommand).rejects(notFoundError())
        s3Mock.on(CreateBucketCommand).rejects(
          new S3ServiceException({
            name,
            $fault: 'client',
            $metadata: { httpStatusCode: 409 },
            message: name,
          })
        )

        await expect(s3Adapter.initializeBucket()).resolves.toBeUndefined()
      }
    )

    it('throws if bucket creation fails for another reason', async () => {
      s3Mock.on(HeadBucketCommand).rejects(notFoundError())
      s3Mock.on(CreateBucketCommand).rejects(accessDeniedError())

      await expect(s3Adapter.initializeBucket()).rejects.toThrow(
        'Access Denied'
      )
    })
  })

  describe('uploadFile', () => {
    it('uploads the file with its content type', async () => {
      const fileBuffer = Buffer.from('test content')
      s3Mock.on(PutObjectCommand).resolves({})

      const result = await s3Adapter.uploadFile(
        'test-file.txt',
        fileBuffer,
        'text/plain'
      )

      expect(result).toBe('test-file.txt')
      expect(s3Mock.commandCalls(PutObjectCommand)[0].args[0].input).toEqual({
        Bucket: BUCKET,
        Key: 'test-file.txt',
        Body: fileBuffer,
        ContentType: 'text/plain',
      })
    })

    it('throws if upload fails', async () => {
      s3Mock.on(PutObjectCommand).rejects(new Error('Upload failed'))

      await expect(
        s3Adapter.uploadFile('test.txt', Buffer.from('test'), 'text/plain')
      ).rejects.toThrow('Upload failed')
    })
  })

  describe('getFile', () => {
    it('returns the object body as a stream', async () => {
      const body = toSdkStream(Readable.from(['file content']))
      s3Mock.on(GetObjectCommand).resolves({ Body: body })

      const result = await s3Adapter.getFile('test-file.txt')

      expect(result).toBe(body)
      expect(s3Mock.commandCalls(GetObjectCommand)[0].args[0].input).toEqual({
        Bucket: BUCKET,
        Key: 'test-file.txt',
      })
    })

    it('throws if the body is not a readable stream', async () => {
      s3Mock.on(GetObjectCommand).resolves({ Body: undefined })

      await expect(s3Adapter.getFile('test-file.txt')).rejects.toThrow(
        "Unexpected body type for file 'test-file.txt'"
      )
    })

    it('throws if retrieval fails', async () => {
      s3Mock.on(GetObjectCommand).rejects(new Error('File not found'))

      await expect(s3Adapter.getFile('nonexistent.txt')).rejects.toThrow(
        'File not found'
      )
    })
  })

  describe('getFileUrl', () => {
    it('generates a presigned URL with default expiry', async () => {
      mockedGetSignedUrl.mockResolvedValue('https://s3.example.com/presigned')

      const result = await s3Adapter.getFileUrl('test-file.txt')

      expect(result).toBe('https://s3.example.com/presigned')
      const [client, command, options] = mockedGetSignedUrl.mock.calls[0]
      expect(client).toBe(s3Adapter.s3Client)
      expect(command).toBeInstanceOf(GetObjectCommand)
      expect(command.input).toEqual({ Bucket: BUCKET, Key: 'test-file.txt' })
      expect(options).toEqual({ expiresIn: 3600 })
    })

    it('generates a presigned URL with custom expiry', async () => {
      mockedGetSignedUrl.mockResolvedValue('https://s3.example.com/presigned')

      await s3Adapter.getFileUrl('test-file.txt', 7200)

      expect(mockedGetSignedUrl.mock.calls[0][2]).toEqual({ expiresIn: 7200 })
    })

    it('throws if URL generation fails', async () => {
      mockedGetSignedUrl.mockRejectedValue(new Error('URL generation failed'))

      await expect(s3Adapter.getFileUrl('test.txt')).rejects.toThrow(
        'URL generation failed'
      )
    })
  })

  describe('deleteFile', () => {
    it('deletes the file', async () => {
      s3Mock.on(DeleteObjectCommand).resolves({})

      await s3Adapter.deleteFile('test-file.txt')

      expect(s3Mock.commandCalls(DeleteObjectCommand)[0].args[0].input).toEqual(
        { Bucket: BUCKET, Key: 'test-file.txt' }
      )
    })

    it('throws if deletion fails', async () => {
      s3Mock.on(DeleteObjectCommand).rejects(new Error('Deletion failed'))

      await expect(s3Adapter.deleteFile('test.txt')).rejects.toThrow(
        'Deletion failed'
      )
    })
  })

  describe('getFileMetadata', () => {
    it('maps the head response to the metadata contract', async () => {
      const lastModified = new Date('2024-01-01T00:00:00Z')
      s3Mock.on(HeadObjectCommand).resolves({
        ContentLength: 1024,
        ETag: '"abc123"',
        LastModified: lastModified,
        ContentType: 'application/pdf',
        Metadata: { 'original-name': 'receipt.pdf' },
      })

      const result = await s3Adapter.getFileMetadata('test-file.pdf')

      expect(result).toEqual({
        name: 'test-file.pdf',
        size: 1024,
        etag: 'abc123',
        lastModified,
        metaData: {
          'content-type': 'application/pdf',
          'x-amz-meta-original-name': 'receipt.pdf',
        },
      })
      expect(s3Mock.commandCalls(HeadObjectCommand)[0].args[0].input).toEqual({
        Bucket: BUCKET,
        Key: 'test-file.pdf',
      })
    })

    it('throws if metadata retrieval fails', async () => {
      s3Mock.on(HeadObjectCommand).rejects(new Error('Metadata failed'))

      await expect(s3Adapter.getFileMetadata('test.txt')).rejects.toThrow(
        'Metadata failed'
      )
    })
  })

  describe('fileExists', () => {
    it('returns true if the file exists', async () => {
      s3Mock.on(HeadObjectCommand).resolves({})

      expect(await s3Adapter.fileExists('test-file.txt')).toBe(true)
    })

    it('returns false if the file does not exist', async () => {
      s3Mock.on(HeadObjectCommand).rejects(notFoundError())

      expect(await s3Adapter.fileExists('nonexistent.txt')).toBe(false)
    })

    it('rethrows errors other than not found', async () => {
      s3Mock.on(HeadObjectCommand).rejects(accessDeniedError())

      await expect(s3Adapter.fileExists('test-file.txt')).rejects.toThrow(
        'Access Denied'
      )
    })
  })

  describe('listFiles', () => {
    it('lists files across all pages with unquoted etags', async () => {
      const lastModified = new Date('2024-01-01T00:00:00Z')
      s3Mock
        .on(ListObjectsV2Command, { ContinuationToken: undefined })
        .resolves({
          Contents: [
            {
              Key: 'documents/file1.txt',
              Size: 100,
              ETag: '"abc123"',
              LastModified: lastModified,
            },
          ],
          IsTruncated: true,
          NextContinuationToken: 'page-2',
        })
        .on(ListObjectsV2Command, { ContinuationToken: 'page-2' })
        .resolves({
          Contents: [
            {
              Key: 'documents/file2.txt',
              Size: 200,
              ETag: '"def456"',
              LastModified: lastModified,
            },
          ],
          IsTruncated: false,
        })

      const result = await s3Adapter.listFiles('documents/')

      expect(result).toEqual([
        {
          name: 'documents/file1.txt',
          size: 100,
          etag: 'abc123',
          lastModified,
        },
        {
          name: 'documents/file2.txt',
          size: 200,
          etag: 'def456',
          lastModified,
        },
      ])
      const calls = s3Mock.commandCalls(ListObjectsV2Command)
      expect(calls).toHaveLength(2)
      expect(calls[0].args[0].input).toEqual({
        Bucket: BUCKET,
        Prefix: 'documents/',
        ContinuationToken: undefined,
      })
      expect(calls[1].args[0].input.ContinuationToken).toBe('page-2')
    })

    it('returns an empty array if no files are found', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({ IsTruncated: false })

      expect(await s3Adapter.listFiles('empty/')).toEqual([])
    })

    it('throws if listing fails', async () => {
      s3Mock.on(ListObjectsV2Command).rejects(new Error('List failed'))

      await expect(s3Adapter.listFiles('error/')).rejects.toThrow('List failed')
    })
  })
})
