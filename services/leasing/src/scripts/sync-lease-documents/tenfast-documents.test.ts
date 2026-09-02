import {
  MAX_UPLOAD_BYTES,
  contentDispositionFor,
  isRetryableResponse,
  isRetryableStatus,
  isTooLarge,
  relatedDocDeletePath,
  retryDelayMs,
} from './tenfast-documents'

describe('contentDispositionFor', () => {
  it('sends swedish characters as rfc5987, which Tenfast decodes correctly', () => {
    // Plain utf-8 bytes in filename="" arrive as "fÃ¶r" — the filename* form
    // is the one Tenfast parses back to "för".
    const disposition = contentDispositionFor('Uppsägning av bostad.pdf')
    expect(disposition).toContain(
      "filename*=UTF-8''Upps%C3%A4gning%20av%20bostad.pdf"
    )
  })

  it('includes an ascii fallback for clients that ignore filename*', () => {
    const disposition = contentDispositionFor('Uppsägning av bostad.pdf')
    expect(disposition).toContain('filename="Uppsagning av bostad.pdf"')
  })

  it('leaves a plain ascii name alone', () => {
    const disposition = contentDispositionFor('Nyckelkvittens.pdf')
    expect(disposition).toContain('filename="Nyckelkvittens.pdf"')
    expect(disposition).toContain("filename*=UTF-8''Nyckelkvittens.pdf")
  })

  it('escapes quotes in the fallback so the header cannot be broken', () => {
    expect(contentDispositionFor('a"b.pdf')).toContain('filename="a_b.pdf"')
  })

  it('always names the form field file', () => {
    expect(contentDispositionFor('x.pdf')).toContain('name="file"')
  })
})

describe('relatedDocDeletePath', () => {
  // Tenfast wants the key's second-to-last segment and the stored (hashed)
  // filename — not the file's _id and not its display name. Sending the _id
  // returns 200 and deletes nothing.
  const key =
    'avtal-related-docs/6a96834173bef530f24f55fe/6a96928e73bef530f27cb500/xaujYd23UgfAi3BoD1.pdf'

  it('takes the folder segment and stored filename from the key', () => {
    expect(relatedDocDeletePath(key)).toBe(
      '6a96928e73bef530f27cb500/xaujYd23UgfAi3BoD1.pdf'
    )
  })

  it('returns null for a key that has no folder segment', () => {
    expect(relatedDocDeletePath('justafile.pdf')).toBeNull()
    expect(relatedDocDeletePath('')).toBeNull()
  })
})

describe('retry policy', () => {
  it('retries rate limiting and server errors', () => {
    expect(isRetryableStatus(429)).toBe(true)
    expect(isRetryableStatus(500)).toBe(true)
    expect(isRetryableStatus(502)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
  })

  it('does not retry a request Tenfast rejected on its merits', () => {
    expect(isRetryableStatus(400)).toBe(false)
    expect(isRetryableStatus(401)).toBe(false)
    expect(isRetryableStatus(404)).toBe(false)
  })

  it('backs off further on each attempt', () => {
    expect(retryDelayMs(1)).toBe(1000)
    expect(retryDelayMs(2)).toBe(3000)
    expect(retryDelayMs(3)).toBe(9000)
  })
})

describe('file size limit', () => {
  it('knows Tenfast rejects anything over 15MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(15 * 1024 * 1024)
    expect(isTooLarge(Buffer.alloc(0))).toBe(false)
    expect(isTooLarge({ length: MAX_UPLOAD_BYTES } as Buffer)).toBe(false)
    expect(isTooLarge({ length: MAX_UPLOAD_BYTES + 1 } as Buffer)).toBe(true)
  })

  it('does not retry a size rejection, despite its 500 status', () => {
    // Tenfast answers "Filen är för stor" with a 500, which otherwise looks
    // retryable — resending a 25MB file twice more helps nobody.
    expect(
      isRetryableResponse(
        500,
        '{"error":"Filen är för stor. Filer får inte överstiga 15MB."}'
      )
    ).toBe(false)
    expect(isRetryableResponse(500, '{"error":"something transient"}')).toBe(
      true
    )
    expect(isRetryableResponse(429, '')).toBe(true)
    expect(isRetryableResponse(400, '')).toBe(false)
  })
})
