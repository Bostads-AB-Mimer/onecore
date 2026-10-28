import { errorName, logger } from '@onecore/utilities'
import type { AdapterResult } from '../../adapters/types'
import { ProcessResult, ProcessStatus } from '../../common/types'

export type SyncStep<U = unknown> = {
  name: string
  // `undo: null` means the step wrote nothing it can put back, such as a new record.
  run: () => Promise<
    AdapterResult<{ skipped: boolean; undo?: U | null }, string>
  >
  undo?: (undo: U) => Promise<AdapterResult<unknown, string>>
}

export const syncStep = <U>(step: SyncStep<U>): SyncStep =>
  step as unknown as SyncStep

export type SyncStepsFailure = { message: string; undoFailed: string[] }

type Failure = { err: string; statusCode?: number; detail?: string }

type StepResult = AdapterResult<{ skipped: boolean; undo?: unknown }, string>

const describeFailure = ({ err, statusCode, detail }: Failure) =>
  err + (statusCode ? ` (${statusCode})` : '') + (detail ? ` [${detail}]` : '')

const list = (label: string, names: string[]) =>
  names.length ? `, ${label}: ${names.join(', ')}` : ''

const runStep = async (
  subject: string,
  step: SyncStep
): Promise<StepResult> => {
  try {
    return await step.run()
  } catch (err) {
    logger.error(
      {
        subject,
        target: step.name,
        errorName: errorName(err),
      },
      'syncSteps.stepThrew'
    )
    return {
      ok: false,
      err: 'unknown',
      detail: errorName(err),
    }
  }
}

const undoStep = async (
  subject: string,
  step: SyncStep,
  undo: unknown
): Promise<AdapterResult<unknown, string>> => {
  try {
    return await step.undo!(undo)
  } catch (err) {
    logger.error(
      {
        subject,
        target: step.name,
        errorName: errorName(err),
      },
      'syncSteps.undoThrew'
    )
    return {
      ok: false,
      err: 'unknown',
      detail: errorName(err),
    }
  }
}

export const runSyncSteps = async ({
  subject,
  steps,
}: {
  subject: string
  steps: SyncStep[]
}): Promise<ProcessResult<null, SyncStepsFailure>> => {
  const finished: { step: SyncStep; skipped: boolean; undo?: unknown }[] = []

  for (const [i, step] of steps.entries()) {
    const result = await runStep(subject, step)
    if (result.ok) {
      finished.push({ step, ...result.data })
      continue
    }

    const written: string[] = []
    const skipped: string[] = []
    const undone: string[] = []
    const undoFailed: string[] = []
    const undoFailures: string[] = []
    const markUndoFailed = (name: string, failure: Failure) => {
      logger.error(
        { subject, target: name, err: failure.err },
        'syncSteps.undoFailed'
      )
      undoFailed.push(name)
      undoFailures.push(`${name}=${describeFailure(failure)}`)
    }

    for (const f of [...finished].reverse()) {
      if (f.skipped) skipped.unshift(f.step.name)
      else if (!f.step.undo || f.undo === null) written.unshift(f.step.name)
      else if (f.undo === undefined)
        markUndoFailed(f.step.name, { err: 'no-undo-data' })
      else {
        const undoResult = await undoStep(subject, f.step, f.undo)
        if (undoResult.ok) undone.push(f.step.name)
        else markUndoFailed(f.step.name, undoResult)
      }
    }

    return {
      processStatus: ProcessStatus.failed,
      httpStatus: 500,
      error: {
        message:
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
        undoFailed,
      },
    }
  }

  return {
    processStatus: ProcessStatus.successful,
    httpStatus: 200,
    data: null,
  }
}
