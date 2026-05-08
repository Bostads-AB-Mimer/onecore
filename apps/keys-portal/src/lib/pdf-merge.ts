import { PDFDocument } from 'pdf-lib'

export async function mergePdfBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) {
    throw new Error('mergePdfBlobs requires at least one blob')
  }

  const merged = await PDFDocument.create()

  for (const blob of blobs) {
    const bytes = await blob.arrayBuffer()
    const source = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(source, source.getPageIndices())
    for (const page of pages) {
      merged.addPage(page)
    }
  }

  const out = await merged.save()
  return new Blob([out], { type: 'application/pdf' })
}
