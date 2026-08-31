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

/**
 * Reads the EXIF orientation tag from JPEG bytes. Returns 1 (upright) when
 * the tag is absent, and 0 when the structure can't be parsed (caller should
 * treat unknown as possibly-rotated).
 */
function readJpegOrientation(bytes: ArrayBuffer): number {
  try {
    const view = new DataView(bytes)
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1

    // Walk the JPEG segment markers looking for APP1 (EXIF)
    let offset = 2
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset)
      if ((marker & 0xff00) !== 0xff00) return 1
      const size = view.getUint16(offset + 2)
      if (marker === 0xffe1) {
        // "Exif\0\0" signature, then the TIFF header
        if (
          offset + 10 > view.byteLength ||
          view.getUint32(offset + 4) !== 0x45786966
        ) {
          return 1
        }
        const tiff = offset + 10
        const littleEndian = view.getUint16(tiff, false) === 0x4949
        const ifdOffset = view.getUint32(tiff + 4, littleEndian)
        let entry = tiff + ifdOffset + 2
        const entryCount = view.getUint16(tiff + ifdOffset, littleEndian)
        for (let i = 0; i < entryCount; i++, entry += 12) {
          if (entry + 12 > view.byteLength) return 0
          // 0x0112 = orientation tag; its value is at entry offset 8
          if (view.getUint16(entry, littleEndian) === 0x0112) {
            return view.getUint16(entry + 8, littleEndian)
          }
        }
        return 1
      }
      offset += 2 + size
    }
    return 1
  } catch {
    return 0
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
        // Only round-trip JPEGs through canvas when a rotation flag is
        // present (or parsing failed) — re-encoding costs a little quality
        const jpegBytes =
          file.type === 'image/jpeg' && readJpegOrientation(bytes) !== 1
            ? await normalizeJpeg(bytes)
            : bytes
        const image =
          file.type === 'image/png'
            ? await mergedDocument.embedPng(bytes)
            : await mergedDocument.embedJpg(jpegBytes)
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
