import { createS3Config } from '../../config/s3'

describe('createS3Config', () => {
  it.each(['https://s3.example.com', 'http://localhost', 'HTTPS://x.y'])(
    'rejects a URL in S3__ENDPOINT (%s)',
    (endpoint) => {
      expect(() => createS3Config({ S3__ENDPOINT: endpoint })).toThrow(
        'S3__ENDPOINT must be a hostname, not a URL'
      )
    }
  )

  it('reads S3__* variables', () => {
    expect(
      createS3Config({
        S3__ENDPOINT: 's3.example.com',
        S3__PORT: '443',
        S3__USE_SSL: 'true',
        S3__ACCESS_KEY: 'access',
        S3__SECRET_KEY: 'secret',
        S3__BUCKET_NAME: 'bucket',
      })
    ).toEqual({
      endpoint: 's3.example.com',
      port: 443,
      useSSL: true,
      accessKey: 'access',
      secretKey: 'secret',
      bucketName: 'bucket',
    })
  })

  it('ignores the removed legacy MINIO__* variables', () => {
    const config = createS3Config({
      MINIO__ENDPOINT: 'minio.example.com',
      MINIO__BUCKET_NAME: 'legacy-bucket',
    })

    expect(config.endpoint).toBe('localhost')
    expect(config.bucketName).toBe('onecore-documents')
  })

  it('uses defaults when nothing is set', () => {
    expect(createS3Config({})).toEqual({
      endpoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: '',
      secretKey: '',
      bucketName: 'onecore-documents',
    })
  })
})
