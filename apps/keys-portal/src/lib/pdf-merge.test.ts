import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'

import { mergePdfBlobs } from './pdf-merge'

async function makePdfBlob(pageCount: number): Promise<Blob> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([200, 200])
  }
  const bytes = await doc.save()
  return new Blob([bytes], { type: 'application/pdf' })
}

describe('mergePdfBlobs', () => {
  it('concatenates pages from multiple PDFs in order', async () => {
    const a = await makePdfBlob(2)
    const b = await makePdfBlob(3)

    const merged = await mergePdfBlobs([a, b])

    expect(merged.type).toBe('application/pdf')

    const buf = await merged.arrayBuffer()
    const reloaded = await PDFDocument.load(buf)
    expect(reloaded.getPageCount()).toBe(5)
  })

  it('returns a single-doc copy when given one blob', async () => {
    const a = await makePdfBlob(4)

    const merged = await mergePdfBlobs([a])

    const buf = await merged.arrayBuffer()
    const reloaded = await PDFDocument.load(buf)
    expect(reloaded.getPageCount()).toBe(4)
  })

  it('throws when given an empty array', async () => {
    await expect(mergePdfBlobs([])).rejects.toThrow()
  })
})
