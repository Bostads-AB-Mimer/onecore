import { logger } from '@onecore/utilities'
import { z } from 'zod'

import config from '../../common/config'
import * as tenfastApi from '../../services/lease-service/adapters/tenfast/tenfast-api'

// Tenfast caps a page at 100 records whatever limit is asked for.
const PAGE_SIZE = 100
const MAX_PAGES = 1000

const baseUrl = () => `${config.tenfast.baseUrl}/v1/hyresvard/avtal`
const company = () => `hyresvard=${config.tenfast.companyId}`

const FileSchema = z.object({
  key: z.string().optional().nullable(),
  originalName: z.string().optional().nullable(),
})

const PageSchema = z.object({
  records: z.array(
    z.object({
      _id: z.string(),
      externalId: z.string().nullable().optional(),
      stage: z.string().nullable().optional(),
      file: FileSchema.optional().nullable(),
      files: z.array(FileSchema).optional().nullable(),
      // Undocumented but present on every listing record; carries the
      // termination file set via upload-termination-file (or by Tenfast).
      cancellation: z
        .object({ file: FileSchema.optional().nullable() })
        .optional()
        .nullable(),
    })
  ),
  next: z.string().nullable().optional(),
  totalCount: z.number().optional(),
})

export type TenfastRelatedFile = {
  key: string
  originalName: string
}

export type TenfastLeaseSummary = {
  id: string
  externalId: string
  stage: string
  hasMainFile: boolean
  mainFileName: string
  relatedFiles: TenfastRelatedFile[]
  hasTerminationFile: boolean
  terminationFileName: string
}

/**
 * Lists every lease with the two things this script needs to stay idempotent:
 * whether a main contract file is already set, and which related documents are
 * already attached. Both come back in the listing, so no per-lease request is
 * needed.
 */
export const fetchLeases = async (): Promise<TenfastLeaseSummary[]> => {
  const leases: TenfastLeaseSummary[] = []
  let cursor = ''

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${baseUrl()}?${company()}&limit=${PAGE_SIZE}${cursor ? `&paginate=${cursor}` : ''}`
    const response = await tenfastApi.request({ method: 'get', url })
    if (response.status !== 200) {
      throw new Error(
        `Tenfast lease listing failed with status ${response.status} on page ${page + 1}`
      )
    }

    const parsed = PageSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(
        `Could not parse Tenfast lease listing on page ${page + 1}: ${parsed.error.issues[0]?.message}`
      )
    }

    for (const record of parsed.data.records) {
      const externalId = record.externalId?.trim()
      if (!externalId) continue
      leases.push({
        id: record._id,
        externalId,
        stage: record.stage ?? '',
        hasMainFile: Boolean(record.file?.key),
        mainFileName: (record.file?.originalName ?? '').trim(),
        relatedFiles: (record.files ?? [])
          .map((file) => ({
            key: (file.key ?? '').trim(),
            originalName: (file.originalName ?? '').trim(),
          }))
          .filter((file) => file.originalName),
        hasTerminationFile: Boolean(record.cancellation?.file?.key),
        terminationFileName: (
          record.cancellation?.file?.originalName ?? ''
        ).trim(),
      })
    }

    if ((page + 1) % 25 === 0) {
      logger.info(
        { page: page + 1, leases: leases.length, of: parsed.data.totalCount },
        'sync-lease-documents: listing Tenfast leases'
      )
    }

    cursor = parsed.data.next ?? ''
    if (!cursor || !parsed.data.records.length) return leases
  }

  throw new Error(`Tenfast lease listing did not finish in ${MAX_PAGES} pages`)
}

type UploadResult = { ok: true } | { ok: false; error: string }

const ASCII_FOLD: Record<string, string> = {
  å: 'a',
  ä: 'a',
  ö: 'o',
  Å: 'A',
  Ä: 'A',
  Ö: 'O',
  é: 'e',
  ü: 'u',
}

/**
 * Builds the file part's Content-Disposition.
 *
 * Tenfast decodes a plain `filename="…"` as latin-1, so utf-8 bytes come back
 * as mojibake — "Uppsägning" is stored as "UppsÃ¤gning". The RFC 5987
 * `filename*` form round-trips correctly, and the ascii-folded `filename=`
 * stays as a fallback for anything that ignores it.
 */
export const contentDispositionFor = (filename: string): string => {
  const fallback = [...filename]
    .map((char) => ASCII_FOLD[char] ?? char)
    .map((char) => (char.charCodeAt(0) > 126 ? '_' : char))
    .join('')
    .replace(/["\\]/g, '_')
  // encodeURIComponent leaves ' ( ) * bare, but they are not RFC 5987
  // attr-chars — Tenfast's parser rejects the whole file part with
  // 500 "Ingen fil bifogades." when they appear unencoded.
  const extValue = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `form-data; name="file"; filename="${fallback}"; filename*=UTF-8''${extValue}`
}

const BOUNDARY = '----onecoreSyncLeaseDocuments'
const MAX_ATTEMPTS = 3

/** Tenfast refuses anything larger, with a 500 and a Swedish message. The
 * limit is 15 decimal MB, not 15 MiB — documents between the two were accepted
 * by a MiB pre-check and still rejected by Tenfast. */
export const MAX_UPLOAD_BYTES = 15 * 1000 * 1000

export const isTooLarge = (content: Buffer): boolean =>
  content.length > MAX_UPLOAD_BYTES

/** Rate limiting and server faults are worth another go; a rejection is not. */
export const isRetryableStatus = (status: number): boolean =>
  status === 429 || status >= 500

/**
 * The size rejection arrives as a 500, so status alone would have us resend a
 * 25MB file twice for nothing.
 */
export const isRetryableResponse = (status: number, body: string): boolean => {
  if (/för stor|for stor|too large/i.test(body ?? '')) return false
  return isRetryableStatus(status)
}

export const retryDelayMs = (attempt: number): number =>
  1000 * 3 ** (attempt - 1)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const postFileOnce = async (
  url: string,
  content: Buffer,
  filename: string
): Promise<UploadResult & { retryable?: boolean }> => {
  try {
    // The multipart body is built by hand so the filename encoding is ours to
    // control; FormData emits a latin-1-unsafe filename that Tenfast mangles.
    const body = Buffer.concat([
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: ${contentDispositionFor(filename)}\r\nContent-Type: application/pdf\r\n\r\n`,
        'utf8'
      ),
      content,
      Buffer.from(`\r\n--${BOUNDARY}--\r\n`, 'utf8'),
    ])

    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-token': config.tenfast.apiKey,
        'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      },
      body,
    })

    if (response.ok) return { ok: true }
    const responseBody = await response.text()
    return {
      ok: false,
      retryable: isRetryableResponse(response.status, responseBody),
      error: `status ${response.status}: ${responseBody.slice(0, 200)}`,
    }
  } catch (err) {
    // A dropped connection or DNS blip is worth retrying.
    return {
      ok: false,
      retryable: true,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

const postFile = async (
  url: string,
  content: Buffer,
  filename: string
): Promise<UploadResult> => {
  let last: UploadResult & { retryable?: boolean } = {
    ok: false,
    error: 'not attempted',
  }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    last = await postFileOnce(url, content, filename)
    if (last.ok || !last.retryable) return last
    if (attempt < MAX_ATTEMPTS) {
      logger.warn(
        { attempt, error: last.error, url: url.split('?')[0] },
        'sync-lease-documents: upload failed, retrying'
      )
      await sleep(retryDelayMs(attempt))
    }
  }
  return last
}

/** Sets the lease's single main contract file. There is no endpoint to undo this. */
export const uploadMainContract = (
  leaseId: string,
  content: Buffer,
  filename: string
): Promise<UploadResult> =>
  postFile(
    `${baseUrl()}/${leaseId}/upload-file?${company()}`,
    content,
    filename
  )

/**
 * The `{file}/{originalName}` pair the delete endpoint expects, taken from the
 * stored key: its second-to-last segment and the stored filename. Sending the
 * file's `_id` and display name instead returns 200 and deletes nothing.
 */
export const relatedDocDeletePath = (key: string): string | null => {
  const parts = (key ?? '').split('/').filter(Boolean)
  if (parts.length < 2) return null
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
}

/** Removes one related document. */
export const deleteRelatedDocument = async (
  leaseId: string,
  key: string
): Promise<UploadResult> => {
  const suffix = relatedDocDeletePath(key)
  if (!suffix) return { ok: false, error: `unusable related-doc key: ${key}` }

  const response = await tenfastApi.request({
    method: 'delete',
    url: `${baseUrl()}/${leaseId}/related-docs/${suffix}?${company()}`,
  })
  return response.status === 200
    ? { ok: true }
    : { ok: false, error: `status ${response.status}` }
}

/** Appends to the lease's related documents; removable with deleteRelatedDocument. */
export const uploadRelatedDocument = (
  leaseId: string,
  content: Buffer,
  filename: string
): Promise<UploadResult> =>
  postFile(
    `${baseUrl()}/${leaseId}/related-docs?${company()}`,
    content,
    filename
  )

/** Sets the lease's termination document. */
export const uploadTerminationFile = (
  leaseId: string,
  content: Buffer,
  filename: string
): Promise<UploadResult> =>
  postFile(
    `${baseUrl()}/${leaseId}/upload-termination-file?${company()}`,
    content,
    filename
  )

/**
 * Whether the lease already has a termination document. The avtal listing does
 * not carry it, so the only way to know is whether the signed-url lookup finds
 * one — 404 with "Uppsägningsdokumentet hittades inte" means it does not.
 */
export const hasTerminationFile = async (leaseId: string): Promise<boolean> => {
  const response = await tenfastApi.request({
    method: 'get',
    url: `${baseUrl()}/${leaseId}/termination-file-url?${company()}`,
  })
  if (response.status === 200) return true
  if (response.status === 404) return false
  throw new Error(
    `termination-file-url for lease ${leaseId} answered ${response.status}`
  )
}
