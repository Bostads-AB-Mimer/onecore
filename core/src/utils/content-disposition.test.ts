import { filenameFromContentDisposition } from './content-disposition'

describe(filenameFromContentDisposition, () => {
  it('reads an unquoted filename with spaces, parentheses and commas', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename=Hyresavi 2026-11-30 - Avtal(1298, 1299).pdf'
      )
    ).toBe('Hyresavi 2026-11-30 - Avtal(1298, 1299).pdf')
  })

  it('reads a quoted filename', () => {
    expect(
      filenameFromContentDisposition('attachment; filename="a; b.pdf"')
    ).toBe('a; b.pdf')
  })

  it('stops an unquoted filename at the next parameter', () => {
    expect(
      filenameFromContentDisposition('attachment; filename=a.pdf; size=10')
    ).toBe('a.pdf')
  })

  it('restores a UTF-8 filename that was read as latin1', () => {
    const asReadByNode = Buffer.from('Hyresavi Västerås.pdf', 'utf8').toString(
      'latin1'
    )

    expect(
      filenameFromContentDisposition(`attachment; filename=${asReadByNode}`)
    ).toBe('Hyresavi Västerås.pdf')
  })

  it('keeps a filename that really is latin1', () => {
    expect(
      filenameFromContentDisposition('attachment; filename=Västerås.pdf')
    ).toBe('Västerås.pdf')
  })

  it('returns undefined without a filename', () => {
    expect(filenameFromContentDisposition('attachment')).toBeUndefined()
    expect(filenameFromContentDisposition('')).toBeUndefined()
  })
})
