export const MERGEABLE_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const

export type MergeableFileType = (typeof MERGEABLE_FILE_TYPES)[number]

export function isMergeableFileType(file: File): boolean {
  return MERGEABLE_FILE_TYPES.includes(file.type as MergeableFileType)
}

const A4_WIDTH_POINTS = 595.28
const A4_HEIGHT_POINTS = 841.89

export class MergeFileError extends Error {
  constructor(fileName: string) {
    super(`Kunde inte läsa filen "${fileName}"`)
    this.name = 'MergeFileError'
  }
}

// pdf-lib's embedJpg ignores EXIF rotation, so portrait phone photos would
// render sideways. Redrawing through a canvas applies the orientation.
async function normalizeJpeg(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(new Blob([bytes]), {
    imageOrientation: 'from-image',
  })
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not get canvas context')
    }
    context.drawImage(bitmap, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('canvas.toBlob failed')),
        'image/jpeg',
        0.92
      )
    })
    return await blob.arrayBuffer()
  } finally {
    bitmap.close()
  }
}

/**
 * Merges PDF, JPEG and PNG files into a single PDF document. Xledger only
 * accepts one attachment per invoice base item, so multiple user-selected
 * files are combined client-side before upload.
 *
 * Throws MergeFileError naming the file if one of them cannot be read
 * (e.g. an encrypted or corrupt PDF).
 */
export async function mergeFilesToPdf(files: File[]): Promise<File> {
  // Dynamic import keeps pdf-lib out of the main bundle
  const { PDFDocument } = await import('pdf-lib')

  const mergedDocument = await PDFDocument.create()

  for (const file of files) {
    try {
      const bytes = await file.arrayBuffer()

      if (file.type === 'application/pdf') {
        const sourceDocument = await PDFDocument.load(bytes)
        const pages = await mergedDocument.copyPages(
          sourceDocument,
          sourceDocument.getPageIndices()
        )
        pages.forEach((page) => mergedDocument.addPage(page))
      } else {
        const image =
          file.type === 'image/png'
            ? await mergedDocument.embedPng(bytes)
            : await mergedDocument.embedJpg(await normalizeJpeg(bytes))
        // Scale down to fit within A4 (1 px = 1 pt would make photos huge),
        // but never upscale small images
        const scale = Math.min(
          1,
          A4_WIDTH_POINTS / image.width,
          A4_HEIGHT_POINTS / image.height
        )
        const width = image.width * scale
        const height = image.height * scale
        const page = mergedDocument.addPage([width, height])
        page.drawImage(image, { x: 0, y: 0, width, height })
      }
    } catch {
      throw new MergeFileError(file.name)
    }
  }

  const mergedBytes = await mergedDocument.save()

  // The copy re-types pdf-lib's Uint8Array<ArrayBufferLike> as ArrayBuffer-
  // backed, which BlobPart requires
  return new File([new Uint8Array(mergedBytes)], 'strofaktura-bilagor.pdf', {
    type: 'application/pdf',
  })
}
