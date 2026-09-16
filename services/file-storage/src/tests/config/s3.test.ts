import { createS3Config } from '../../config/s3'

describe('createS3Config', () => {
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

  it('falls back to legacy MINIO__* variables', () => {
    expect(
      createS3Config({
        MINIO__ENDPOINT: 'minio.example.com',
        MINIO__PORT: '9001',
        MINIO__USE_SSL: 'true',
        MINIO__ACCESS_KEY: 'legacy-access',
        MINIO__SECRET_KEY: 'legacy-secret',
        MINIO__BUCKET_NAME: 'legacy-bucket',
      })
    ).toEqual({
      endpoint: 'minio.example.com',
      port: 9001,
      useSSL: true,
      accessKey: 'legacy-access',
      secretKey: 'legacy-secret',
      bucketName: 'legacy-bucket',
    })
  })

  it('prefers S3__* over MINIO__* when both are set', () => {
    const config = createS3Config({
      S3__ENDPOINT: 's3.example.com',
      MINIO__ENDPOINT: 'minio.example.com',
      MINIO__BUCKET_NAME: 'legacy-bucket',
    })

    expect(config.endpoint).toBe('s3.example.com')
    // Keys not set under S3__ still fall back individually
    expect(config.bucketName).toBe('legacy-bucket')
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
