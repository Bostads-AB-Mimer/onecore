import { logger } from '@onecore/utilities'
import { ProcessResult, ProcessStatus } from '../../common/types'
import { runSyncSteps, syncStep, SyncStepsFailure } from './index'

const ok =
  <U>(undo?: U) =>
  async () => ({
    ok: true as const,
    data: { skipped: false, ...(undo !== undefined && { undo }) },
  })
const fail = (err: string, statusCode?: number) => async () => ({
  ok: false as const,
  err,
  ...(statusCode && { statusCode }),
})

const caught = async (
  promise: Promise<ProcessResult<null, SyncStepsFailure>>
) => {
  const result = await promise
  if (result.processStatus !== ProcessStatus.failed)
    throw new Error('expected runSyncSteps to fail')
  return result.error
}

afterEach(() => jest.restoreAllMocks())

describe('runSyncSteps', () => {
  it('runs every step in order and resolves', async () => {
    const order: string[] = []
    const step = (name: string) =>
      syncStep({
        name,
        run: async () => {
          order.push(name)
          return { ok: true, data: { skipped: false } }
        },
      })

    const result = await runSyncSteps({
      subject: 'contact P1',
      steps: [step('a'), step('b')],
    })

    expect(order).toEqual(['a', 'b'])
    expect(result.processStatus).toBe(ProcessStatus.successful)
  })

  it('undoes finished steps newest first with the objects they returned', async () => {
    const undone: string[] = []
    const undoA = jest.fn(async () => {
      undone.push('a')
      return { ok: true as const, data: null }
    })
    const undoB = jest.fn(async () => {
      undone.push('b')
      return { ok: true as const, data: null }
    })

    const err = await caught(
      runSyncSteps({
        subject: 'contact P1',
        steps: [
          syncStep({ name: 'a', run: ok({ v: 'A' }), undo: undoA }),
          syncStep({ name: 'b', run: ok({ v: 'B' }), undo: undoB }),
          syncStep({ name: 'c', run: fail('sync-failed', 500) }),
        ],
      })
    )

    expect(undone).toEqual(['b', 'a'])
    expect(undoA).toHaveBeenCalledWith({ v: 'A' })
    expect(undoB).toHaveBeenCalledWith({ v: 'B' })
    expect(err.message).toBe(
      'contact P1 failed to sync: c=sync-failed (500), undone: b, a'
    )
    expect(err.undoFailed).toEqual([])
  })

  it('lists a finished step with a null undo, or no undo function, as already written', async () => {
    const undo = jest.fn()
    const err = await caught(
      runSyncSteps({
        subject: 'lease L1',
        steps: [
          syncStep({ name: 'xledger', run: ok(null), undo }),
          syncStep({ name: 'odoo', run: ok() }),
          syncStep({ name: 'tenfast', run: fail('sync-failed') }),
        ],
      })
    )

    expect(undo).not.toHaveBeenCalled()
    expect(err.undoFailed).toEqual([])
    expect(err.message).toBe(
      'lease L1 failed to sync: tenfast=sync-failed, already written: xledger, odoo'
    )
  })

  it('counts a finished step that has an undo function but returned no undo object as an undo failure', async () => {
    const undo = jest.fn()
    const err = await caught(
      runSyncSteps({
        subject: 'contact P1',
        steps: [
          syncStep({ name: 'xledger', run: ok(), undo }),
          syncStep({ name: 'tenfast', run: fail('sync-failed') }),
        ],
      })
    )

    expect(undo).not.toHaveBeenCalled()
    expect(err.undoFailed).toEqual(['xledger'])
    expect(err.message).toBe(
      'contact P1 failed to sync: tenfast=sync-failed, undo failed: xledger=no-undo-data'
    )
  })

  it('lists skipped steps and does not undo them', async () => {
    const undo = jest.fn()
    const err = await caught(
      runSyncSteps({
        subject: 'contact P1',
        steps: [
          syncStep({
            name: 'xledger',
            run: async () => ({ ok: true, data: { skipped: true, undo: {} } }),
            undo,
          }),
          syncStep({ name: 'odoo', run: fail('sync-failed') }),
          syncStep({ name: 'tenfast', run: ok() }),
        ],
      })
    )

    expect(undo).not.toHaveBeenCalled()
    expect(err.message).toBe(
      'contact P1 failed to sync: odoo=sync-failed, skipped: xledger, not attempted: tenfast'
    )
  })

  it('keeps undoing after one undo fails and names the failure', async () => {
    const undoA = jest.fn(async () => ({ ok: true as const, data: null }))
    const undoB = jest.fn(async () => ({
      ok: false as const,
      err: 'undo-failed',
      statusCode: 500,
    }))

    const err = await caught(
      runSyncSteps({
        subject: 'contact P1',
        steps: [
          syncStep({ name: 'a', run: ok(1), undo: undoA }),
          syncStep({ name: 'b', run: ok(2), undo: undoB }),
          syncStep({ name: 'c', run: fail('sync-failed') }),
        ],
      })
    )

    expect(undoA).toHaveBeenCalled()
    expect(err.undoFailed).toEqual(['b'])
    expect(err.message).toBe(
      'contact P1 failed to sync: c=sync-failed, undone: a, undo failed: b=undo-failed (500)'
    )
  })

  it('counts an undo that throws as failed', async () => {
    const err = await caught(
      runSyncSteps({
        subject: 'contact P1',
        steps: [
          syncStep({
            name: 'a',
            run: ok(1),
            undo: async () => {
              throw new Error('boom')
            },
          }),
          syncStep({ name: 'b', run: fail('sync-failed') }),
        ],
      })
    )

    expect(err.undoFailed).toEqual(['a'])
    expect(err.message).toContain('undo failed: a=unknown [Error]')
  })

  it('treats a step that throws as failed and still undoes the finished steps', async () => {
    const undoA = jest.fn(async () => ({ ok: true as const, data: null }))

    const err = await caught(
      runSyncSteps({
        subject: 'contact P1',
        steps: [
          syncStep({ name: 'a', run: ok(1), undo: undoA }),
          syncStep({
            name: 'b',
            run: async () => {
              throw new TypeError('boom')
            },
          }),
        ],
      })
    )

    expect(undoA).toHaveBeenCalledWith(1)
    expect(err.message).toBe(
      'contact P1 failed to sync: b=unknown [TypeError], outcome unknown, undone: a'
    )
  })

  it('logs why a step threw', async () => {
    const errorSpy = jest.spyOn(logger, 'error')

    await caught(
      runSyncSteps({
        subject: 'contact P1',
        steps: [
          syncStep({
            name: 'b',
            run: async () => {
              throw new TypeError('boom')
            },
          }),
        ],
      })
    )

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'contact P1',
        target: 'b',
        errorName: 'TypeError',
      }),
      'syncSteps.stepThrew'
    )
  })

  it('says outcome unknown when the failing step got no answer', async () => {
    const err = await caught(
      runSyncSteps({
        subject: 'contact P1',
        steps: [syncStep({ name: 'tenfast', run: fail('unknown', 500) })],
      })
    )

    expect(err.message).toBe(
      'contact P1 failed to sync: tenfast=unknown (500), outcome unknown'
    )
  })

  it('includes the detail of the failing step', async () => {
    const err = await caught(
      runSyncSteps({
        subject: 'lease L1',
        steps: [
          syncStep({
            name: 'xledger',
            run: async () => ({
              ok: false,
              err: 'sync-failed',
              detail: 'contact-lookup-threw',
            }),
          }),
          syncStep({ name: 'tenfast', run: ok() }),
        ],
      })
    )

    expect(err.message).toBe(
      'lease L1 failed to sync: xledger=sync-failed [contact-lookup-threw], not attempted: tenfast'
    )
  })

  it('keeps the message of a thrown error out of the log and the result', async () => {
    const errorSpy = jest.spyOn(logger, 'error')

    const err = await caught(
      runSyncSteps({
        subject: 'contact P1',
        steps: [
          syncStep({
            name: 'a',
            run: ok(1),
            undo: async () => {
              throw new Error('could not write Hemlig, Person')
            },
          }),
          syncStep({
            name: 'b',
            run: async () => {
              throw new Error('rejected Hemlig, Person')
            },
          }),
        ],
      })
    )

    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('Hemlig')
    expect(err.message).not.toContain('Hemlig')
  })

  it('logs no undo values', async () => {
    const errorSpy = jest.spyOn(logger, 'error')

    await caught(
      runSyncSteps({
        subject: 'contact P1',
        steps: [
          syncStep({
            name: 'a',
            run: ok({ previous: { fullName: 'Hemlig, Person' } }),
            undo: async () => ({ ok: false, err: 'undo-failed' }),
          }),
          syncStep({ name: 'b', run: fail('sync-failed') }),
        ],
      })
    )

    expect(errorSpy).toHaveBeenCalled()
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('Hemlig')
  })
})
