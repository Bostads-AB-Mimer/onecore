import { describe, expect, it } from 'vitest'

import type { Component, ComponentEvent } from '@/services/types'

import {
  buildComponentHistory,
  getHistorySectionState,
  type HistoryRow,
} from './componentHistory'
import { formatSek } from './componentRows'

type Installation = NonNullable<Component['componentInstallations']>[number]

const event = (overrides: Partial<ComponentEvent> = {}): ComponentEvent => ({
  id: 'e1',
  componentId: 'c1',
  eventType: 'INSPECTED',
  occurredAt: '2026-03-10',
  sourceType: 'MANUAL',
  sourceId: null,
  relatedComponentId: null,
  actor: 'Anna Andersson (26abcd)',
  note: null,
  createdAt: '2026-03-10T08:15:00.000Z',
  ...overrides,
})

const installation = (overrides: Partial<Installation> = {}): Installation => ({
  id: 'i1',
  componentId: 'c1',
  spaceId: 'room-1',
  spaceType: 'OBJECT',
  installationDate: '2020-05-01T00:00:00.000Z',
  deinstallationDate: null,
  orderNumber: null,
  cost: 0,
  createdAt: '2020-05-01T10:00:00.000Z',
  updatedAt: '2020-05-01T10:00:00.000Z',
  propertyObject: {
    id: 'po1',
    propertyStructures: [
      {
        residenceCode: '0202',
        residenceName: 'HAGA PARKGATA 6 C',
        roomName: 'Kök',
        roomCode: 'KOK',
      },
    ],
  },
  ...overrides,
})

const plain = { isSurface: false }
const surface = { isSurface: true }

const keys = (rows: HistoryRow[]) => rows.map((row) => row.key)

const onlyRow = (rows: HistoryRow[]): HistoryRow => {
  expect(rows).toHaveLength(1)
  const [row] = rows
  if (!row) throw new Error('expected one row')
  return row
}

describe('buildComponentHistory event labels', () => {
  it.each<[ComponentEvent['eventType'], string, string]>([
    ['INSTALLED', 'Installerad', 'Installerad'],
    ['DEINSTALLED', 'Avinstallerad', 'Avinstallerad'],
    ['REPAIRED', 'Reparerad', 'Åtgärdad'],
    ['REPLACED', 'Utbytt', 'Förnyad'],
    ['NO_ACTION', 'Ingen åtgärd', 'Ingen åtgärd'],
    ['INSPECTED', 'Besiktigad', 'Besiktigad'],
  ])(
    'labels %s as %s, and as %s on a surface',
    (eventType, label, surfaceLabel) => {
      const events = [event({ eventType })]

      expect(onlyRow(buildComponentHistory([], events, plain)).label).toBe(
        label
      )
      expect(onlyRow(buildComponentHistory([], events, surface)).label).toBe(
        surfaceLabel
      )
    }
  )

  it('falls back to a generic label for an event type it does not know', () => {
    // Stands in for an event type the API added after this frontend was built
    const futureType: string = 'RENEWED'
    const events = [
      event({ eventType: futureType as ComponentEvent['eventType'] }),
    ]

    expect(onlyRow(buildComponentHistory([], events, plain)).label).toBe(
      'Händelse'
    )
    expect(onlyRow(buildComponentHistory([], events, surface)).label).toBe(
      'Händelse'
    )
  })
})

describe('buildComponentHistory event rows', () => {
  it.each<[Partial<ComponentEvent>, string]>([
    [{ sourceType: 'WORK_ORDER', sourceId: 'od-12' }, 'Ärende od-12'],
    [{ sourceType: 'INSPECTION', sourceId: '13034' }, 'Besiktning 13034'],
    [{ sourceType: 'MANUAL', sourceId: null }, 'Manuell'],
    [{ sourceType: 'MANUAL', sourceId: 'x-1' }, 'Manuell'],
    [{ sourceType: 'WORK_ORDER', sourceId: null }, 'Ärende'],
    [{ sourceType: 'INSPECTION', sourceId: null }, 'Besiktning'],
  ])('names the source of %o as %s', (source, expected) => {
    expect(
      onlyRow(buildComponentHistory([], [event(source)], plain)).source
    ).toBe(expected)
  })

  it('leaves the source empty for a source type it does not know', () => {
    // Stands in for a source type the API added after this frontend was built
    const futureSource: string = 'ODOO_IMPORT'
    const events = [
      event({
        sourceType: futureSource as ComponentEvent['sourceType'],
        sourceId: '7',
      }),
    ]

    expect(onlyRow(buildComponentHistory([], events, plain)).source).toBeNull()
  })

  it('shows the event as recorded', () => {
    expect(
      buildComponentHistory(
        [],
        [
          event({
            id: 'e7',
            eventType: 'INSPECTED',
            occurredAt: '2026-01-01',
            sourceType: 'INSPECTION',
            sourceId: '13034',
            actor: 'Anna Andersson (26abcd)',
            note: 'Skadad',
            relatedComponentId: '00000000-0000-0000-0000-00000000dead',
          }),
        ],
        plain
      )
    ).toEqual([
      {
        key: 'event-e7',
        kind: 'event',
        label: 'Besiktigad',
        date: '2026-01-01',
        dateLabel: '2026-01-01',
        source: 'Besiktning 13034',
        place: null,
        actor: 'Anna Andersson (26abcd)',
        note: 'Skadat',
        isCurrent: false,
      },
    ])
  })

  it.each([
    ['God', 'Gott skick'],
    ['Acceptabel', 'Godtagbart skick'],
    ['Skadad', 'Skadat'],
    ['Okej', 'Okej'],
  ])(
    'shows the inspection note %s with the condition label %s',
    (note, expected) => {
      expect(
        onlyRow(
          buildComponentHistory(
            [],
            [event({ eventType: 'INSPECTED', note })],
            plain
          )
        ).note
      ).toBe(expected)
    }
  )

  it('keeps the note of any other event type as written', () => {
    expect(
      onlyRow(
        buildComponentHistory(
          [],
          [event({ eventType: 'REPAIRED', note: 'God' })],
          plain
        )
      ).note
    ).toBe('God')
  })

  it('keeps a missing note as null', () => {
    expect(
      onlyRow(buildComponentHistory([], [event({ note: null })], plain)).note
    ).toBeNull()
  })

  it('keeps the calendar day in a time zone behind UTC', () => {
    const originalTz = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      // Proves the zone took effect: parsing would land on the day before
      expect(new Date('2026-01-01').getDate()).toBe(31)

      const rows = buildComponentHistory(
        [
          installation({
            installationDate: '2020-05-01T00:00:00.000Z',
            deinstallationDate: '2024-02-01T00:00:00.000Z',
          }),
        ],
        [event({ occurredAt: '2026-01-01' })],
        plain
      )

      expect(rows.map((row) => row.dateLabel)).toEqual([
        '2026-01-01',
        '2024-02-01',
        '2020-05-01',
      ])
    } finally {
      // Assigning undefined would store the string 'undefined'
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    }
  })
})

describe('buildComponentHistory installation rows', () => {
  it('marks an installation without a deinstallation date as current', () => {
    expect(buildComponentHistory([installation()], [], plain)).toEqual([
      {
        key: 'installation-i1',
        kind: 'installation',
        label: 'Installerad',
        date: '2020-05-01',
        dateLabel: '2020-05-01',
        source: null,
        place: { address: 'HAGA PARKGATA 6 C', detail: '0202 · Kök' },
        actor: null,
        note: null,
        isCurrent: true,
      },
    ])
  })

  it('adds a deinstallation row above its installation', () => {
    const rows = buildComponentHistory(
      [installation({ deinstallationDate: '2024-02-01T00:00:00.000Z' })],
      [],
      plain
    )

    expect(rows).toEqual([
      {
        key: 'deinstallation-i1',
        kind: 'deinstallation',
        label: 'Avinstallerad',
        date: '2024-02-01',
        dateLabel: '2024-02-01',
        source: null,
        place: { address: 'HAGA PARKGATA 6 C', detail: '0202 · Kök' },
        actor: null,
        note: null,
        isCurrent: false,
      },
      expect.objectContaining({ key: 'installation-i1', isCurrent: false }),
    ])
  })

  it('keeps the deinstallation row above its installation on the same day', () => {
    const rows = buildComponentHistory(
      [
        installation({
          installationDate: '2024-02-01T00:00:00.000Z',
          deinstallationDate: '2024-02-01T00:00:00.000Z',
        }),
      ],
      [],
      plain
    )

    expect(keys(rows)).toEqual(['deinstallation-i1', 'installation-i1'])
  })

  it('shows the cost as the note on the installation row', () => {
    const rows = buildComponentHistory(
      [
        installation({
          cost: 12500,
          deinstallationDate: '2024-02-01T00:00:00.000Z',
        }),
      ],
      [],
      plain
    )

    expect(rows.map((row) => row.note)).toEqual([null, formatSek(12500)])
  })

  it('leaves the note empty when the cost is unknown', () => {
    expect(
      onlyRow(buildComponentHistory([installation({ cost: 0 })], [], plain))
        .note
    ).toBeNull()
  })

  it.each([null, '1900-01-01T00:00:00.000Z'])(
    'shows an unknown installation date (%s) as Okänt',
    (installationDate) => {
      const row = onlyRow(
        buildComponentHistory([installation({ installationDate })], [], plain)
      )

      expect(row.date).toBeNull()
      expect(row.dateLabel).toBe('Okänt')
    }
  )

  it('shows a dash for the place when the installation has no structure', () => {
    expect(
      onlyRow(
        buildComponentHistory(
          [installation({ propertyObject: null })],
          [],
          plain
        )
      ).place
    ).toEqual({ address: null, detail: '-' })
  })
})

describe('buildComponentHistory sorting', () => {
  it('puts the newest first', () => {
    const rows = buildComponentHistory(
      [
        installation({
          id: 'old',
          installationDate: '2010-01-01T00:00:00.000Z',
          deinstallationDate: '2019-06-01T00:00:00.000Z',
        }),
        installation({
          id: 'new',
          installationDate: '2019-06-02T00:00:00.000Z',
        }),
      ],
      [
        event({ id: 'repair', occurredAt: '2015-03-01' }),
        event({ id: 'inspection', occurredAt: '2026-03-10' }),
      ],
      plain
    )

    expect(keys(rows)).toEqual([
      'event-inspection',
      'installation-new',
      'deinstallation-old',
      'event-repair',
      'installation-old',
    ])
  })

  it('puts the new installation above the old deinstallation on a same-day move', () => {
    const rows = buildComponentHistory(
      [
        installation({
          id: 'old',
          installationDate: '2010-01-01T00:00:00.000Z',
          deinstallationDate: '2019-06-01T00:00:00.000Z',
        }),
        installation({
          id: 'new',
          installationDate: '2019-06-01T00:00:00.000Z',
        }),
      ],
      [],
      plain
    )

    expect(keys(rows)).toEqual([
      'installation-new',
      'deinstallation-old',
      'installation-old',
    ])
  })

  it('treats an installation with an unknown date as the oldest on a same-day move', () => {
    const rows = buildComponentHistory(
      [
        installation({
          id: 'placeholder',
          installationDate: '1900-01-01T00:00:00.000Z',
          deinstallationDate: '2019-06-01T00:00:00.000Z',
        }),
        installation({
          id: 'new',
          installationDate: '2019-06-01T00:00:00.000Z',
        }),
      ],
      [],
      plain
    )

    expect(keys(rows)).toEqual([
      'installation-new',
      'deinstallation-placeholder',
      'installation-placeholder',
    ])
  })

  it('puts unknown dates last', () => {
    const rows = buildComponentHistory(
      [
        installation({
          id: 'placeholder',
          installationDate: '1900-01-01T00:00:00.000Z',
        }),
        installation({ id: 'missing', installationDate: null }),
      ],
      [event({ id: 'old', occurredAt: '1999-01-01' })],
      plain
    )

    expect(keys(rows)).toEqual([
      'event-old',
      'installation-placeholder',
      'installation-missing',
    ])
  })

  it('puts events before installation rows on the same date', () => {
    const rows = buildComponentHistory(
      [
        installation({
          id: 'a',
          installationDate: '2020-05-01T00:00:00.000Z',
          deinstallationDate: '2024-02-01T00:00:00.000Z',
        }),
      ],
      [
        event({ id: 'installed', occurredAt: '2020-05-01' }),
        event({ id: 'removed', occurredAt: '2024-02-01' }),
      ],
      plain
    )

    expect(keys(rows)).toEqual([
      'event-removed',
      'deinstallation-a',
      'event-installed',
      'installation-a',
    ])
  })

  it('keeps input order for rows on the same date and of the same kind', () => {
    const rows = buildComponentHistory(
      [installation({ id: 'first' }), installation({ id: 'second' })],
      [
        event({ id: 'b', occurredAt: '2026-03-10' }),
        event({ id: 'a', occurredAt: '2026-03-10' }),
      ],
      plain
    )

    expect(keys(rows)).toEqual([
      'event-b',
      'event-a',
      'installation-first',
      'installation-second',
    ])
  })
})

describe('buildComponentHistory empty inputs', () => {
  it('returns no rows without installations or events', () => {
    expect(buildComponentHistory(undefined, [], plain)).toEqual([])
    expect(buildComponentHistory([], [], plain)).toEqual([])
  })

  it('shows events when the installations are missing', () => {
    expect(keys(buildComponentHistory(undefined, [event()], plain))).toEqual([
      'event-e1',
    ])
  })
})

describe('getHistorySectionState', () => {
  type QueryState<T> = {
    data: T | undefined
    isPending: boolean
    isError: boolean
  }

  const loaded = <T>(data: T | undefined): QueryState<T> => ({
    data,
    isPending: false,
    isError: false,
  })
  const pending = <T>(): QueryState<T> => ({
    data: undefined,
    isPending: true,
    isError: false,
  })
  // React Query keeps the last data when a refetch fails
  const failed = <T>(data?: T): QueryState<T> => ({
    data,
    isPending: false,
    isError: true,
  })

  // getHistorySectionState reads only the installations of the by-id component
  const componentWith = (
    componentInstallations: Installation[] | undefined
  ): Component => ({ componentInstallations }) as unknown as Component

  const fromList = [installation({ id: 'active' })]
  const fromId = componentWith([
    installation({
      id: 'past',
      installationDate: '2010-01-01T00:00:00.000Z',
      deinstallationDate: '2019-06-01T00:00:00.000Z',
    }),
    installation({ id: 'active' }),
  ])

  it('prefers the installations of the component loaded by id', () => {
    expect(
      getHistorySectionState(
        {
          component: loaded(fromId),
          fallbackInstallations: fromList,
          events: loaded([]),
        },
        plain
      )
    ).toEqual({
      status: 'ready',
      rows: [
        expect.objectContaining({ key: 'installation-active' }),
        expect.objectContaining({ key: 'deinstallation-past' }),
        expect.objectContaining({ key: 'installation-past' }),
      ],
    })
  })

  it('uses the fallback installations when the component fails to load', () => {
    expect(
      getHistorySectionState(
        {
          component: failed(),
          fallbackInstallations: fromList,
          events: loaded([event()]),
        },
        plain
      )
    ).toEqual({
      status: 'error',
      rows: [
        expect.objectContaining({ key: 'event-e1' }),
        expect.objectContaining({ key: 'installation-active' }),
      ],
    })
  })

  it('keeps cached events and the installations when the events fail', () => {
    expect(
      getHistorySectionState(
        {
          component: loaded(fromId),
          fallbackInstallations: fromList,
          events: failed([event()]),
        },
        plain
      )
    ).toEqual({
      status: 'error',
      rows: [
        expect.objectContaining({ key: 'event-e1' }),
        expect.objectContaining({ key: 'installation-active' }),
        expect.objectContaining({ key: 'deinstallation-past' }),
        expect.objectContaining({ key: 'installation-past' }),
      ],
    })
  })

  it.each([
    ['the component', pending<Component>(), loaded([])],
    ['the events', loaded(fromId), pending<ComponentEvent[]>()],
  ])('is loading while %s is pending', (_, component, events) => {
    expect(
      getHistorySectionState(
        { component, fallbackInstallations: fromList, events },
        plain
      )
    ).toEqual({ status: 'loading' })
  })

  it.each([
    ['the component', failed<Component>(), loaded([])],
    ['the events', loaded(fromId), failed<ComponentEvent[]>()],
    [
      'the events while the component is pending',
      pending<Component>(),
      failed<ComponentEvent[]>(),
    ],
  ])('is an error when %s fails', (_, component, events) => {
    expect(
      getHistorySectionState(
        { component, fallbackInstallations: fromList, events },
        plain
      ).status
    ).toBe('error')
  })

  it('is an error, not empty, when both fail and nothing is known', () => {
    expect(
      getHistorySectionState(
        {
          component: failed(),
          fallbackInstallations: undefined,
          events: failed(),
        },
        plain
      )
    ).toEqual({ status: 'error', rows: [] })
  })

  it('is empty when there are neither events nor installations', () => {
    expect(
      getHistorySectionState(
        {
          component: loaded(componentWith(undefined)),
          fallbackInstallations: undefined,
          events: loaded([]),
        },
        plain
      )
    ).toEqual({ status: 'empty' })
    expect(
      getHistorySectionState(
        {
          component: loaded(componentWith([])),
          fallbackInstallations: [],
          events: loaded(undefined),
        },
        plain
      )
    ).toEqual({ status: 'empty' })
  })

  it('is ready with events and installations merged', () => {
    expect(
      getHistorySectionState(
        {
          component: loaded(componentWith(fromList)),
          fallbackInstallations: fromList,
          events: loaded([event({ eventType: 'REPAIRED' })]),
        },
        surface
      )
    ).toEqual({
      status: 'ready',
      rows: [
        expect.objectContaining({ key: 'event-e1', label: 'Åtgärdad' }),
        expect.objectContaining({ key: 'installation-active' }),
      ],
    })
  })
})
