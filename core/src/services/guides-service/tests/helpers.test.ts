import { isPlainBase64, isUuidParam, matchesImageMagicBytes } from '../helpers'

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])
const webp = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
])

describe('matchesImageMagicBytes', () => {
  it('accepts files whose magic bytes match the declared type', () => {
    expect(matchesImageMagicBytes(png, 'image/png')).toBe(true)
    expect(matchesImageMagicBytes(jpeg, 'image/jpeg')).toBe(true)
    expect(matchesImageMagicBytes(webp, 'image/webp')).toBe(true)
  })

  it('rejects a file whose magic bytes belong to another type', () => {
    expect(matchesImageMagicBytes(png, 'image/jpeg')).toBe(false)
    expect(matchesImageMagicBytes(jpeg, 'image/png')).toBe(false)
    // RIFF container that is not WEBP (e.g. a WAV file)
    const riffWave = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WAVE', 'ascii'),
    ])
    expect(matchesImageMagicBytes(riffWave, 'image/webp')).toBe(false)
  })

  it('rejects arbitrary content and unknown content types', () => {
    expect(matchesImageMagicBytes(Buffer.from('<html>'), 'image/png')).toBe(
      false
    )
    expect(matchesImageMagicBytes(Buffer.alloc(0), 'image/png')).toBe(false)
    expect(matchesImageMagicBytes(png, 'image/gif')).toBe(false)
  })
})

describe('isPlainBase64', () => {
  it('accepts base64 with and without padding', () => {
    expect(isPlainBase64(Buffer.from('hello').toString('base64'))).toBe(true)
    expect(isPlainBase64('QUJD')).toBe(true)
  })

  it('rejects data: urls, whitespace and other non-base64 characters', () => {
    expect(isPlainBase64('data:image/png;base64,QUJD')).toBe(false)
    expect(isPlainBase64('QUJD QUJD')).toBe(false)
    expect(isPlainBase64('QUJD\nQUJD')).toBe(false)
    expect(isPlainBase64('')).toBe(false)
  })
})

describe('isUuidParam', () => {
  it('accepts a uuid and rejects anything else', () => {
    expect(isUuidParam('3f1d9b3e-1f9a-4f5c-9a6e-2c2a5b6d7e8f')).toBe(true)
    expect(isUuidParam('categories')).toBe(false)
    expect(isUuidParam(undefined)).toBe(false)
  })
})
