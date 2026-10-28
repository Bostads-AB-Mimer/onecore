import { logger } from '@onecore/utilities'
import * as economyAdapter from '../../adapters/economy-adapter'
import {
  runSyncSteps,
  syncStep,
  SyncStepsError,
  undoContactSyncInEconomy,
} from './index'

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

const caught = async (promise: Promise<void>) => {
  try {
    await promise
  } catch (err) {
    return err as SyncStepsError
  }
  throw new Error('expected runSyncSteps to throw')
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

    await runSyncSteps({ subject: 'contact P1', steps: [step('a'), step('b')] })

    expect(order).toEqual(['a', 'b'])
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
    expect(err).toBeInstanceOf(SyncStepsError)
    expect(err.message).toBe(
      'contact P1 failed to sync: c=sync-failed (500), undone: b, a'
    )
    expect(err.undoFailed).toEqual([])
  })

  it('lists a finished step without an undo object as already written', async () => {
    const undo = jest.fn()
    const err = await caught(
      runSyncSteps({
        subject: 'lease L1',
        steps: [
          syncStep({ name: 'xledger', run: ok(), undo }),
          syncStep({ name: 'tenfast', run: fail('sync-failed') }),
        ],
      })
    )

    expect(undo).not.toHaveBeenCalled()
    expect(err.message).toBe(
      'lease L1 failed to sync: tenfast=sync-failed, already written: xledger'
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
    expect(err.message).toContain('undo failed: a=unknown')
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

describe('undoContactSyncInEconomy', () => {
  const undo = {
    previous: {
      fullName: 'Gammal, Namn',
      street: null,
      zipCode: null,
      city: null,
      emailAddress: null,
    },
  }

  it('writes the previous values back without create', async () => {
    const sync = jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    const result = await undoContactSyncInEconomy('P1', undo)

    expect(sync).toHaveBeenCalledWith('P1', undo.previous)
    expect(result).toEqual({ ok: true, data: null })
  })

  it('fails with not-found when economy skips', async () => {
    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: true, data: { skipped: true } })

    expect(await undoContactSyncInEconomy('P1', undo)).toEqual({
      ok: false,
      err: 'not-found',
    })
  })

  it('passes a failure through', async () => {
    jest
      .spyOn(economyAdapter, 'syncContactToEconomy')
      .mockResolvedValue({ ok: false, err: 'sync-failed', statusCode: 500 })

    expect(await undoContactSyncInEconomy('P1', undo)).toEqual({
      ok: false,
      err: 'sync-failed',
      statusCode: 500,
    })
  })
})
