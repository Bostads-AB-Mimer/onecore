import { logger } from '@onecore/utilities'
import type { SyncContactToEconomyUndo } from '@onecore/types'
import type { AdapterResult } from '../../adapters/types'
import { syncContactToEconomy } from '../../adapters/economy-adapter'

export type SyncStep<U = unknown> = {
  name: string
  run: () => Promise<AdapterResult<{ skipped: boolean; undo?: U }, string>>
  undo?: (undo: U) => Promise<AdapterResult<unknown, string>>
}

export const syncStep = <U>(step: SyncStep<U>): SyncStep =>
  step as unknown as SyncStep

export class SyncStepsError extends Error {
  constructor(
    message: string,
    readonly undoFailed: string[]
  ) {
    super(message)
    this.name = 'SyncStepsError'
  }
}

type Failure = { err: string; statusCode?: number; detail?: string }

const describeFailure = ({ err, statusCode, detail }: Failure) =>
  err + (statusCode ? ` (${statusCode})` : '') + (detail ? ` [${detail}]` : '')

const list = (label: string, names: string[]) =>
  names.length ? `, ${label}: ${names.join(', ')}` : ''

export const runSyncSteps = async ({
  subject,
  steps,
}: {
  subject: string
  steps: SyncStep[]
}): Promise<void> => {
  const finished: { step: SyncStep; skipped: boolean; undo?: unknown }[] = []

  for (const [i, step] of steps.entries()) {
    let result: AdapterResult<{ skipped: boolean; undo?: unknown }, string>
    try {
      result = await step.run()
    } catch {
      result = { ok: false, err: 'unknown' }
    }
    if (result.ok) {
      finished.push({ step, ...result.data })
      continue
    }

    const written: string[] = []
    const skipped: string[] = []
    const toUndo: { step: SyncStep; undo: unknown }[] = []
    for (const f of finished) {
      if (f.skipped) skipped.push(f.step.name)
      else if (f.undo === undefined || !f.step.undo) written.push(f.step.name)
      else toUndo.push({ step: f.step, undo: f.undo })
    }

    const undone: string[] = []
    const undoFailed: string[] = []
    const undoFailures: string[] = []
    for (const { step: done, undo } of toUndo.reverse()) {
      let undoResult: AdapterResult<unknown, string>
      try {
        undoResult = await done.undo!(undo)
      } catch {
        undoResult = { ok: false, err: 'unknown' }
      }
      if (undoResult.ok) {
        undone.push(done.name)
        continue
      }
      logger.error(
        { subject, target: done.name, err: undoResult.err },
        'syncSteps.undoFailed'
      )
      undoFailed.push(done.name)
      undoFailures.push(`${done.name}=${describeFailure(undoResult)}`)
    }

    throw new SyncStepsError(
      `${subject} failed to sync: ${step.name}=${describeFailure(result)}` +
        (result.err === 'unknown' ? ', outcome unknown' : '') +
        list('already written', written) +
        list('undone', undone) +
        list('undo failed', undoFailures) +
        list('skipped', skipped) +
        list(
          'not attempted',
          steps.slice(i + 1).map((s) => s.name)
        ),
      undoFailed
    )
  }
}

export const undoContactSyncInEconomy = async (
  contactCode: string,
  undo: SyncContactToEconomyUndo
): Promise<AdapterResult<null, string>> => {
  const result = await syncContactToEconomy(contactCode, undo.previous)
  if (!result.ok) return result
  return result.data.skipped
    ? { ok: false, err: 'not-found' }
    : { ok: true, data: null }
}
