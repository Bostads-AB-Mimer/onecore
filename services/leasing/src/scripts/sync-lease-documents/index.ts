import fs from 'fs/promises'
import path from 'path'
import { logger } from '@onecore/utilities'

import { inspectPdf } from './classification'
import { LeasePlan, PdfTraits, planLease, uploadFilename } from './plan'
import {
  MAX_UPLOAD_BYTES,
  fetchLeases,
  isTooLarge,
  uploadMainContract,
  uploadRelatedDocument,
} from './tenfast-documents'
import {
  XpandLeaseDocument,
  createDbClient,
  fetchAllLeaseDocuments,
  fetchDocumentContent,
} from './xpand-documents'

const DEFAULT_OUT_DIR = './sync-lease-documents'
const DEFAULT_CONCURRENCY = 4
const PROGRESS_EVERY = 100
// Stop rather than spend hours turning a Tenfast outage into failed rows.
const DEFAULT_MAX_FAILURES = 25

type Options = {
  outDir: string
  dryRun: boolean
  limitLeases: number
  concurrency: number
  stages: string[]
  leases: string[]
  maxFailures: number
}

type Action = {
  leaseId: string
  tenfastId: string
  target: 'upload-file' | 'related-docs'
  keydorev: string
  filename: string
  bytes: number
  status: 'uploaded' | 'failed' | 'no-content' | 'too-large'
  error?: string
}

const parseArgs = (argv: string[]): Options => {
  const options: Options = {
    outDir: process.env.SYNC_OUT_DIR ?? DEFAULT_OUT_DIR,
    dryRun: false,
    limitLeases: 0,
    concurrency: DEFAULT_CONCURRENCY,
    stages: [],
    leases: [],
    maxFailures: DEFAULT_MAX_FAILURES,
  }

  const valueOf = (token: string, index: number): string => {
    const inline = token.indexOf('=')
    if (inline !== -1) return token.slice(inline + 1)
    const next = argv[index + 1]
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`Missing value for ${token}`)
    }
    return next
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--') continue
    const flag = token.split('=')[0]
    const consume = () => {
      const value = valueOf(token, i)
      if (!token.includes('=')) i++
      return value
    }
    switch (flag) {
      case '--out':
        options.outDir = consume()
        break
      case '--limit-leases':
        options.limitLeases = Number(consume())
        break
      case '--concurrency':
        options.concurrency = Number(consume())
        break
      case '--max-failures':
        options.maxFailures = Number(consume())
        break
      case '--leases':
        options.leases = consume()
          .split(',')
          .map((lease) => lease.trim())
          .filter(Boolean)
        break
      case '--stages':
        options.stages = consume()
          .split(',')
          .map((stage) => stage.trim())
          .filter(Boolean)
        break
      case '--dry-run':
        options.dryRun = true
        break
      default:
        throw new Error(`Unknown argument: ${token}`)
    }
  }

  if (!Number.isFinite(options.limitLeases) || options.limitLeases < 0) {
    throw new Error('--limit-leases must be a non-negative number')
  }
  if (!Number.isFinite(options.concurrency) || options.concurrency < 1) {
    throw new Error('--concurrency must be at least 1')
  }
  if (!Number.isFinite(options.maxFailures) || options.maxFailures < 0) {
    throw new Error('--max-failures must be a non-negative number')
  }
  return options
}

const csvField = (value: string | number): string => {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const parseCsvLine = (line: string): string[] => {
  const fields: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char !== '"') field += char
      else if (line[i + 1] === '"') {
        field += '"'
        i++
      } else inQuotes = false
    } else if (char === '"') inQuotes = true
    else if (char === ',') {
      fields.push(field)
      field = ''
    } else field += char
  }
  fields.push(field)
  return fields
}

const ACTIONS_HEADER =
  'leaseId,tenfastId,target,keydorev,filename,bytes,status,error'

/**
 * The resume key for a row that already succeeded, or null. Parsed properly
 * rather than split on commas: filenames contain commas, so a quoted field
 * shifts every column after it and an uploaded document would look unfinished.
 */
export const completedKeyFromRow = (line: string): string | null => {
  if (!line.trim() || line === ACTIONS_HEADER) return null
  const [leaseId, , target, keydorev, , , status] = parseCsvLine(line)
  if (status !== 'uploaded') return null
  return `${leaseId}|${target}|${keydorev}`
}

const formatCreatedAt = (createdAt: Date | null): string => {
  if (!createdAt) return ''
  const time = createdAt.getTime()
  return isNaN(time) ? '' : createdAt.toISOString().slice(0, 10)
}

/**
 * Documents Tenfast refuses on size are collected into their own file so they
 * can be dealt with by hand later — every column is something you need to find
 * the document again in xpand.
 */
export const OVERSIZED_HEADER =
  'leaseId,tenfastId,wouldHaveGoneTo,documentTitle,filename,bytes,sizeMiB,keydorev,xpandDok,documentType,createdAt'

type OversizedDocument = {
  leaseId: string
  tenfastId: string
  target: Action['target']
  title: string
  filename: string
  bytes: number
  keydorev: string
  dok: string
  documentType: string
  createdAt: string
}

export const oversizedRow = (document: OversizedDocument): string =>
  [
    document.leaseId,
    document.tenfastId,
    document.target,
    document.title,
    document.filename,
    document.bytes,
    // MiB, so it compares directly against Tenfast's 15 MiB limit
    (document.bytes / 1024 / 1024).toFixed(1),
    document.keydorev,
    document.dok,
    document.documentType,
    document.createdAt,
  ]
    .map(csvField)
    .join(',')

export const syncLeaseDocuments = async (options: Options) => {
  const startedAt = new Date()
  logger.info({ options }, 'sync-lease-documents: starting')

  await fs.mkdir(options.outDir, { recursive: true })
  const actionsPath = path.join(options.outDir, 'actions.csv')
  const decisionsPath = path.join(options.outDir, 'contract-decisions.csv')

  // Resume: anything already recorded as uploaded is not sent again.
  const done = new Set<string>()
  try {
    const existing = await fs.readFile(actionsPath, 'utf-8')
    for (const line of existing.split('\n')) {
      const key = completedKeyFromRow(line)
      if (key) done.add(key)
    }
  } catch {
    await fs.writeFile(actionsPath, `${ACTIONS_HEADER}\n`, 'utf-8')
  }
  if (done.size) {
    logger.info(
      { alreadyUploaded: done.size },
      'sync-lease-documents: resuming from previous run'
    )
  }

  const allLeases = await fetchLeases()
  const wanted = new Set(options.leases)
  const leases = allLeases
    .filter((lease) => !wanted.size || wanted.has(lease.externalId))
    .filter(
      (lease) => !options.stages.length || options.stages.includes(lease.stage)
    )
  logger.info(
    { total: allLeases.length, selected: leases.length },
    'sync-lease-documents: fetched Tenfast leases'
  )

  const db = createDbClient(options.concurrency)
  try {
    const documentsByLease = await fetchAllLeaseDocuments(db)
    logger.info(
      { leasesWithDocuments: documentsByLease.size },
      'sync-lease-documents: loaded xpand documents'
    )

    const selected = options.limitLeases
      ? leases.slice(0, options.limitLeases)
      : leases

    // First pass: plan without touching file contents.
    const plans: LeasePlan[] = selected.map((lease) =>
      planLease(lease, documentsByLease.get(lease.externalId) ?? [])
    )

    // Second pass: only leases with competing contracts need their PDFs read.
    const contested = plans.filter((plan) => plan.needsInspection)
    logger.info(
      { leasesNeedingInspection: contested.length },
      'sync-lease-documents: inspecting competing contracts'
    )
    const resolved: LeasePlan[] = []
    const traitsByLease = new Map<string, Map<string, PdfTraits>>()
    for (const plan of plans) {
      if (!plan.needsInspection) {
        resolved.push(plan)
        continue
      }
      const traits = new Map<string, PdfTraits>()
      traitsByLease.set(plan.lease.externalId, traits)
      for (const candidate of plan.contractCandidates) {
        const content = await fetchDocumentContent(db, candidate.keydorev)
        traits.set(
          candidate.keydorev,
          content ? inspectPdf(content) : { signed: false, isScan: false }
        )
      }
      resolved.push(
        planLease(
          plan.lease,
          documentsByLease.get(plan.lease.externalId) ?? [],
          traits
        )
      )
    }

    // Record every contested decision so the picks can be reviewed.
    const decisions = [
      'leaseId,candidateKeydorev,candidateTitle,candidateCreated,signed,isScan,chosen',
    ]
    for (const plan of resolved) {
      if (plan.contractCandidates.length < 2) continue
      const traits = traitsByLease.get(plan.lease.externalId)
      for (const candidate of plan.contractCandidates) {
        const trait = traits?.get(candidate.keydorev)
        decisions.push(
          [
            plan.lease.externalId,
            candidate.keydorev,
            candidate.title,
            candidate.createdAt?.toISOString().slice(0, 10) ?? '',
            String(trait?.signed ?? false),
            String(trait?.isScan ?? false),
            String(candidate.keydorev === plan.contract?.keydorev),
          ]
            .map(csvField)
            .join(',')
        )
      }
    }
    await fs.writeFile(decisionsPath, `${decisions.join('\n')}\n`, 'utf-8')

    const summary = {
      leases: resolved.length,
      withContract: resolved.filter((plan) => plan.contract).length,
      contested: contested.length,
      noDocuments: resolved.filter(
        (plan) => plan.contractSkippedReason === 'no documents in xpand'
      ).length,
      noContract: resolved.filter(
        (plan) => plan.contractSkippedReason === 'no contract document found'
      ).length,
      alreadyHadMainFile: resolved.filter(
        (plan) => plan.contractSkippedReason === 'lease already has a main file'
      ).length,
      relatedToUpload: resolved.reduce(
        (total, plan) => total + plan.related.length,
        0
      ),
      alreadyAttached: resolved.reduce(
        (total, plan) => total + plan.alreadyAttached.length,
        0
      ),
    }
    logger.info(summary, 'sync-lease-documents: plan')

    if (options.dryRun) {
      const preview = ['leaseId,target,filename,title']
      for (const plan of resolved) {
        if (plan.contract) {
          preview.push(
            [
              plan.lease.externalId,
              'upload-file',
              plan.filenames.get(plan.contract.keydorev) ??
                uploadFilename(plan.contract),
              plan.contract.title,
            ]
              .map(csvField)
              .join(',')
          )
        }
        for (const document of plan.related) {
          preview.push(
            [
              plan.lease.externalId,
              'related-docs',
              plan.filenames.get(document.keydorev) ?? uploadFilename(document),
              document.title,
            ]
              .map(csvField)
              .join(',')
          )
        }
      }
      await fs.writeFile(
        path.join(options.outDir, 'dry-run.csv'),
        `${preview.join('\n')}\n`,
        'utf-8'
      )
      await fs.writeFile(
        path.join(options.outDir, 'report.json'),
        `${JSON.stringify({ startedAt: startedAt.toISOString(), dryRun: true, options, ...summary }, null, 2)}\n`,
        'utf-8'
      )
      logger.info(
        { outDir: options.outDir, plannedUploads: preview.length - 1 },
        'sync-lease-documents: dry run complete, nothing sent to Tenfast'
      )
      return summary
    }

    // Upload.
    let uploaded = 0
    let failed = 0
    const oversized: OversizedDocument[] = []
    let actionsChain: Promise<void> = Promise.resolve()
    const record = (action: Action) => {
      actionsChain = actionsChain.then(() =>
        fs.appendFile(
          actionsPath,
          `${[
            action.leaseId,
            action.tenfastId,
            action.target,
            action.keydorev,
            action.filename,
            action.bytes,
            action.status,
            action.error ?? '',
          ]
            .map(csvField)
            .join(',')}\n`,
          'utf-8'
        )
      )
      return actionsChain
    }

    const send = async (
      plan: LeasePlan,
      document: XpandLeaseDocument,
      target: Action['target']
    ) => {
      const key = `${plan.lease.externalId}|${target}|${document.keydorev}`
      if (done.has(key)) return

      const filename =
        plan.filenames.get(document.keydorev) ?? uploadFilename(document)
      const content = await fetchDocumentContent(db, document.keydorev)
      if (!content) {
        await record({
          leaseId: plan.lease.externalId,
          tenfastId: plan.lease.id,
          target,
          keydorev: document.keydorev,
          filename,
          bytes: 0,
          status: 'no-content',
        })
        return
      }

      if (isTooLarge(content)) {
        oversized.push({
          leaseId: plan.lease.externalId,
          tenfastId: plan.lease.id,
          target,
          title: document.title,
          filename,
          bytes: content.length,
          keydorev: document.keydorev,
          dok: document.dok,
          documentType: document.documentType,
          createdAt: formatCreatedAt(document.createdAt),
        })
        await record({
          leaseId: plan.lease.externalId,
          tenfastId: plan.lease.id,
          target,
          keydorev: document.keydorev,
          filename,
          bytes: content.length,
          status: 'too-large',
          error: `exceeds Tenfast's ${MAX_UPLOAD_BYTES} byte limit`,
        })
        return
      }

      const result =
        target === 'upload-file'
          ? await uploadMainContract(plan.lease.id, content, filename)
          : await uploadRelatedDocument(plan.lease.id, content, filename)

      if (result.ok) uploaded++
      else failed++
      await record({
        leaseId: plan.lease.externalId,
        tenfastId: plan.lease.id,
        target,
        keydorev: document.keydorev,
        filename,
        bytes: content.length,
        status: result.ok ? 'uploaded' : 'failed',
        error: result.ok ? undefined : result.error,
      })
    }

    let cursor = 0
    let processed = 0
    let aborted = false
    await Promise.all(
      Array.from({ length: options.concurrency }, async () => {
        for (;;) {
          if (aborted) return
          const index = cursor++
          if (index >= resolved.length) return
          const plan = resolved[index]
          try {
            if (plan.contract) await send(plan, plan.contract, 'upload-file')
            for (const document of plan.related) {
              await send(plan, document, 'related-docs')
            }
          } catch (err) {
            failed++
            logger.error(
              {
                err: err instanceof Error ? err.message : String(err),
                leaseId: plan.lease.externalId,
              },
              'sync-lease-documents: lease failed'
            )
          }
          if (
            options.maxFailures &&
            failed >= options.maxFailures &&
            !aborted
          ) {
            aborted = true
            logger.error(
              { failed, maxFailures: options.maxFailures, processed },
              'sync-lease-documents: too many failures, stopping — rerun to resume'
            )
            return
          }
          if (++processed % PROGRESS_EVERY === 0) {
            logger.info(
              { processed, of: resolved.length, uploaded, failed },
              'sync-lease-documents: progress'
            )
          }
        }
      })
    )
    await actionsChain

    if (oversized.length) {
      await fs.writeFile(
        path.join(options.outDir, 'oversized.csv'),
        `${[OVERSIZED_HEADER, ...oversized.map(oversizedRow)].join('\n')}\n`,
        'utf-8'
      )
      logger.warn(
        {
          documents: oversized.length,
          limitMiB: MAX_UPLOAD_BYTES / 1024 / 1024,
          file: path.join(options.outDir, 'oversized.csv'),
        },
        'sync-lease-documents: documents too large for Tenfast, listed for manual handling'
      )
    }

    const finishedAt = new Date()
    const report = {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationSeconds: Math.round(
        (finishedAt.getTime() - startedAt.getTime()) / 1000
      ),
      options,
      ...summary,
      uploaded,
      failed,
      tooLarge: oversized.length,
      aborted,
    }
    await fs.writeFile(
      path.join(options.outDir, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf-8'
    )
    logger.info(report, 'sync-lease-documents: run complete')
    return report
  } finally {
    await db.destroy()
  }
}

if (require.main === module) {
  syncLeaseDocuments(parseArgs(process.argv.slice(2)))
    .then((result) => {
      process.exitCode = 'failed' in result && result.failed ? 1 : 0
    })
    .catch((err) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'sync-lease-documents: script failed'
      )
      process.exitCode = 1
    })
}

export { parseArgs }
