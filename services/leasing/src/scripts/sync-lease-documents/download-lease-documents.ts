/**
 * Downloads every xpand document linked to one lease, for eyeballing before or
 * after a sync run.
 *
 *   ts-node src/scripts/sync-lease-documents/download-lease-documents.ts \
 *     --lease 705-727-00-0015/07 --out ./lease-docs
 */
import fs from 'fs/promises'
import path from 'path'
import { logger } from '@onecore/utilities'

import { classifyDocument, inspectPdf } from './classification'
import { uploadFilename } from './plan'
import {
  createDbClient,
  fetchAllLeaseDocuments,
  fetchDocumentContent,
} from './xpand-documents'

const safeSegment = (value: string): string =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._ ]+|[._ ]+$/g, '')

const parseArgs = (argv: string[]) => {
  let lease = ''
  let outDir = './lease-docs'
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--') continue
    const [flag, inline] = token.split('=')
    const value = inline ?? argv[++i]
    if (flag === '--lease') lease = value
    else if (flag === '--out') outDir = value
    else throw new Error(`Unknown argument: ${token}`)
  }
  if (!lease) {
    throw new Error('--lease is required, e.g. --lease 705-727-00-0015/07')
  }
  return { lease, outDir }
}

export const downloadLeaseDocuments = async (lease: string, outDir: string) => {
  const db = createDbClient(4)
  try {
    const documents = (await fetchAllLeaseDocuments(db)).get(lease) ?? []
    if (!documents.length) {
      logger.warn({ lease }, 'download-lease-documents: no documents for lease')
      return
    }

    const targetDir = path.join(outDir, safeSegment(lease))
    await fs.mkdir(targetDir, { recursive: true })

    const written: Array<Record<string, unknown>> = []
    let index = 0
    for (const document of documents) {
      index++
      const category = classifyDocument(document.title)
      const content = await fetchDocumentContent(db, document.keydorev)
      if (!content) {
        written.push({
          index,
          category,
          title: document.title,
          file: '(no content)',
        })
        continue
      }

      const traits = inspectPdf(content)
      const created = document.createdAt
        ? document.createdAt.toISOString().slice(0, 10)
        : 'nodate'
      const filename = `${String(index).padStart(2, '0')}-${category}-${created}-${uploadFilename(document)}`
      await fs.writeFile(path.join(targetDir, filename), content)
      written.push({
        index,
        category,
        created,
        signed: traits.signed,
        scan: traits.isScan,
        bytes: content.length,
        title: document.title.slice(0, 52),
      })
    }

    logger.info(
      { lease, documents: written.length, outDir: targetDir },
      'download-lease-documents: done'
    )
    console.table(written)
  } finally {
    await db.destroy()
  }
}

if (require.main === module) {
  const { lease, outDir } = parseArgs(process.argv.slice(2))
  downloadLeaseDocuments(lease, outDir).catch((err) => {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'download-lease-documents: failed'
    )
    process.exitCode = 1
  })
}
