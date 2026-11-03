import { logger } from '@onecore/utilities'

import * as propertyBaseAdapter from '../../../../adapters/property-base-adapter'
import type { InternalInspection } from '../../../../adapters/inspection-adapter'
import { writeBackComponentInspectionStates } from '../component-write-back'

jest.mock('../../../../adapters/property-base-adapter')

const updateComponentInspectionState = jest.mocked(
  propertyBaseAdapter.updateComponentInspectionState
)
const createComponentEvent = jest.mocked(
  propertyBaseAdapter.createComponentEvent
)

type InspectedComponent = {
  componentId: string
  label: string
  condition: string
}

// Only the fields the write-back reads are filled in; the rest of the
// generated InternalInspection shape is irrelevant here, hence the cast.
const makeInspection = (
  overrides: Partial<InternalInspection> = {},
  components: InspectedComponent[] = [
    { componentId: 'c-1', label: 'Golv', condition: 'Skadad' },
    { componentId: 'c-2', label: 'Vägg', condition: 'God' },
  ]
): InternalInspection =>
  ({
    id: 'insp-1',
    inspector: 'Anna Andersson (26ab12)',
    endedAt: '2026-06-14T10:00:00.000Z',
    rooms: [{ roomId: 'room-1', components }],
    ...overrides,
  }) as unknown as InternalInspection

const updateOk = {
  ok: true,
  data: {},
  statusCode: 200,
} as unknown as Awaited<
  ReturnType<typeof propertyBaseAdapter.updateComponentInspectionState>
>

type CreateEventResult = Awaited<
  ReturnType<typeof propertyBaseAdapter.createComponentEvent>
>

// The helper only reads `ok`, so the event payload is left empty
const eventCreated = {
  ok: true,
  data: {},
  statusCode: 201,
} as unknown as CreateEventResult

const EVENT_ERROR = 'Kunde inte spara besiktningshändelsen'

describe('writeBackComponentInspectionStates', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    jest.resetAllMocks()
    updateComponentInspectionState.mockResolvedValue(updateOk)
    createComponentEvent.mockResolvedValue(eventCreated)
  })

  it('returns [] without calling the adapter when endedAt is null', async () => {
    const result = await writeBackComponentInspectionStates(
      makeInspection({ endedAt: null })
    )

    expect(result).toEqual([])
    expect(updateComponentInspectionState).not.toHaveBeenCalled()
  })

  it('returns [] when rooms is missing', async () => {
    const result = await writeBackComponentInspectionStates(
      makeInspection({ rooms: null })
    )

    expect(result).toEqual([])
    expect(updateComponentInspectionState).not.toHaveBeenCalled()
  })

  it('writes mapped condition and endedAt per component', async () => {
    await writeBackComponentInspectionStates(
      makeInspection({}, [
        { componentId: 'c-1', label: 'Golv', condition: 'Skadad' },
        { componentId: 'c-2', label: 'Vägg', condition: 'God' },
        { componentId: 'c-3', label: 'Tak', condition: 'Acceptabel' },
      ])
    )

    expect(updateComponentInspectionState).toHaveBeenCalledTimes(3)
    expect(updateComponentInspectionState).toHaveBeenCalledWith('c-1', {
      condition: 'DAMAGED',
      lastInspectionDate: '2026-06-14T10:00:00.000Z',
    })
    expect(updateComponentInspectionState).toHaveBeenCalledWith('c-2', {
      condition: 'GOOD',
      lastInspectionDate: '2026-06-14T10:00:00.000Z',
    })
    expect(updateComponentInspectionState).toHaveBeenCalledWith('c-3', {
      condition: 'FAIR',
      lastInspectionDate: '2026-06-14T10:00:00.000Z',
    })
  })

  it('skips components with no condition or an unknown condition', async () => {
    const result = await writeBackComponentInspectionStates(
      makeInspection({}, [
        { componentId: 'c-1', label: 'Golv', condition: '' },
        { componentId: 'c-2', label: 'Vägg', condition: 'Trasig' },
      ])
    )

    expect(result).toEqual([])
    expect(updateComponentInspectionState).not.toHaveBeenCalled()
  })

  it('collects adapter errors with Swedish messages', async () => {
    updateComponentInspectionState.mockImplementation(async (componentId) =>
      componentId === 'c-1' ? { ok: false, err: 'not_found' } : updateOk
    )

    const result = await writeBackComponentInspectionStates(makeInspection())

    expect(result).toEqual([
      {
        componentId: 'c-1',
        componentLabel: 'Golv',
        message: 'Komponenten hittades inte',
      },
    ])
  })

  it('maps a rejected promise to the upstream_error message', async () => {
    updateComponentInspectionState.mockImplementation(async (componentId) => {
      if (componentId === 'c-1') throw new Error('boom')
      return updateOk
    })

    const result = await writeBackComponentInspectionStates(makeInspection())

    expect(result).toEqual([
      {
        componentId: 'c-1',
        componentLabel: 'Golv',
        message: 'Kunde inte uppdatera komponenten',
      },
    ])
  })

  describe('INSPECTED events', () => {
    it('creates one INSPECTED event per inspected component', async () => {
      const result = await writeBackComponentInspectionStates(makeInspection())

      expect(result).toEqual([])
      expect(createComponentEvent).toHaveBeenCalledTimes(2)
      expect(createComponentEvent).toHaveBeenCalledWith('c-1', {
        eventType: 'INSPECTED',
        sourceType: 'INSPECTION',
        sourceId: 'insp-1',
        occurredAt: '2026-06-14',
        actor: 'Anna Andersson (26ab12)',
        note: 'Skadad',
      })
      expect(createComponentEvent).toHaveBeenCalledWith('c-2', {
        eventType: 'INSPECTED',
        sourceType: 'INSPECTION',
        sourceId: 'insp-1',
        occurredAt: '2026-06-14',
        actor: 'Anna Andersson (26ab12)',
        note: 'God',
      })
    })

    it('uses the Swedish date when the inspection ends just after midnight', async () => {
      await writeBackComponentInspectionStates(
        makeInspection({ endedAt: '2026-06-14T22:30:00.000Z' })
      )

      expect(createComponentEvent).toHaveBeenCalledWith(
        'c-1',
        expect.objectContaining({ occurredAt: '2026-06-15' })
      )
    })

    it('does not create events for skipped components', async () => {
      await writeBackComponentInspectionStates(
        makeInspection({}, [
          { componentId: 'c-1', label: 'Golv', condition: '' },
          { componentId: 'c-2', label: 'Vägg', condition: 'Trasig' },
        ])
      )

      expect(createComponentEvent).not.toHaveBeenCalled()
    })

    it('treats an already recorded event (200) as success', async () => {
      createComponentEvent.mockResolvedValue({
        ...eventCreated,
        statusCode: 200,
      } as CreateEventResult)

      const result = await writeBackComponentInspectionStates(makeInspection())

      expect(result).toEqual([])
    })

    it('reports an event failure without affecting the condition write', async () => {
      createComponentEvent.mockImplementation(async (componentId) =>
        componentId === 'c-1'
          ? { ok: false, err: 'bad_request', message: 'x' }
          : eventCreated
      )

      const result = await writeBackComponentInspectionStates(makeInspection())

      expect(updateComponentInspectionState).toHaveBeenCalledWith(
        'c-1',
        expect.objectContaining({ condition: 'DAMAGED' })
      )
      expect(result).toEqual([
        { componentId: 'c-1', componentLabel: 'Golv', message: EVENT_ERROR },
      ])
    })

    it('logs a rejected event body as an error', async () => {
      const errorSpy = jest.spyOn(logger, 'error').mockImplementation()
      createComponentEvent.mockResolvedValue({
        ok: false,
        err: 'bad_request',
        message: 'actor too long',
      })

      await writeBackComponentInspectionStates(makeInspection())

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ componentId: 'c-1', err: 'bad_request' }),
        'Failed to create INSPECTED component event'
      )
    })

    it('does not log upstream_error again, the adapter already did', async () => {
      const errorSpy = jest.spyOn(logger, 'error').mockImplementation()
      createComponentEvent.mockResolvedValue({
        ok: false,
        err: 'upstream_error',
      })

      await writeBackComponentInspectionStates(makeInspection())

      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('reports condition and event failures separately for the same component', async () => {
      updateComponentInspectionState.mockImplementation(async (componentId) =>
        componentId === 'c-1' ? { ok: false, err: 'upstream_error' } : updateOk
      )
      createComponentEvent.mockImplementation(async (componentId) =>
        componentId === 'c-1'
          ? { ok: false, err: 'upstream_error' }
          : eventCreated
      )

      const result = await writeBackComponentInspectionStates(makeInspection())

      expect(result).toHaveLength(2)
      expect(result).toEqual(
        expect.arrayContaining([
          {
            componentId: 'c-1',
            componentLabel: 'Golv',
            message: 'Kunde inte uppdatera komponenten',
          },
          { componentId: 'c-1', componentLabel: 'Golv', message: EVENT_ERROR },
        ])
      )
    })

    it('maps a rejected event promise to the event message', async () => {
      createComponentEvent.mockImplementation(async (componentId) => {
        if (componentId === 'c-1') throw new Error('boom')
        return eventCreated
      })

      const result = await writeBackComponentInspectionStates(makeInspection())

      expect(result).toEqual([
        { componentId: 'c-1', componentLabel: 'Golv', message: EVENT_ERROR },
      ])
    })

    it('skips events but writes conditions when inspector is blank', async () => {
      const result = await writeBackComponentInspectionStates(
        makeInspection({ inspector: '   ' })
      )

      expect(createComponentEvent).not.toHaveBeenCalled()
      expect(updateComponentInspectionState).toHaveBeenCalledTimes(2)
      expect(result).toEqual([
        { componentId: 'c-1', componentLabel: 'Golv', message: EVENT_ERROR },
        { componentId: 'c-2', componentLabel: 'Vägg', message: EVENT_ERROR },
      ])
    })
  })
})
