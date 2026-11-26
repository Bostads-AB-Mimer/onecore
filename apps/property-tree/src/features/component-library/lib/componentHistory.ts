import { isKnownInstallationDate } from '@/entities/component/lib/componentCalculations'

import type { Component, ComponentEvent } from '@/services/types'

import {
  describeStructure,
  formatComponentCondition,
  formatSek,
  type PlaceLabel,
} from './componentRows'

export type HistoryRowKind = 'event' | 'installation' | 'deinstallation'

export interface HistoryRow {
  /** Stable React key, unique within one history */
  key: string
  kind: HistoryRowKind
  label: string
  /** 'YYYY-MM-DD', or null when the date is unknown (sorts last) */
  date: string | null
  /** The date as shown ('Okänt' when unknown) */
  dateLabel: string
  /** Event source: 'Ärende od-12' | 'Besiktning <id>' | 'Manuell'; null on
   * installation and deinstallation rows and for an unknown source type */
  source: string | null
  /** Where the component was installed; installation and deinstallation rows only */
  place: PlaceLabel | null
  actor: string | null
  /** Event note, or the formatted cost on an installation row that has one */
  note: string | null
  /** Installation row without a deinstallation date ("Nuvarande") */
  isCurrent: boolean
}

export type HistorySectionState =
  | { status: 'loading' }
  // Whatever is known so far; a request failed and must never read as "no history"
  | { status: 'error'; rows: HistoryRow[] }
  | { status: 'empty' }
  | { status: 'ready'; rows: HistoryRow[] }

type QueryState<T> = {
  data: T | undefined
  isPending: boolean
  isError: boolean
}

type EventType = ComponentEvent['eventType']
type Installation = NonNullable<Component['componentInstallations']>[number]

// Exhaustive, so a new event type in the API schema fails the typecheck until it has a label
const EVENT_LABELS: Record<EventType, string> = {
  INSTALLED: 'Installerad',
  DEINSTALLED: 'Avinstallerad',
  REPAIRED: 'Reparerad',
  REPLACED: 'Utbytt',
  NO_ACTION: 'Ingen åtgärd',
  INSPECTED: 'Besiktigad',
}

// A wall, floor or ceiling is treated and renewed rather than repaired and replaced
const SURFACE_EVENT_LABELS: Partial<Record<EventType, string>> = {
  REPAIRED: 'Åtgärdad',
  REPLACED: 'Förnyad',
}

// Shown when the API sends an event type this frontend doesn't know yet
const UNKNOWN_EVENT_LABEL = 'Händelse'

// Exhaustive for the same reason as EVENT_LABELS
const SOURCE_LABELS: Record<ComponentEvent['sourceType'], string> = {
  WORK_ORDER: 'Ärende',
  INSPECTION: 'Besiktning',
  MANUAL: 'Manuell',
}

// An INSPECTED event stores the inspector's own word for the condition. Core
// maps the same words onto component.condition, so the note is shown with the
// condition labels used everywhere else in the library.
const INSPECTION_NOTE_CONDITIONS = new Map([
  ['God', 'GOOD'],
  ['Acceptabel', 'FAIR'],
  ['Skadad', 'DAMAGED'],
])

const UNKNOWN_DATE_LABEL = 'Okänt'

// Dates arrive as 'YYYY-MM-DD' or as UTC midnight of that day. Cutting the
// string keeps the calendar day; parsing it into a Date could shift it by one.
const toDay = (value: string | null | undefined): string | null =>
  value ? value.slice(0, 10) : null

const withDate = (date: string | null) => ({
  date,
  dateLabel: date ?? UNKNOWN_DATE_LABEL,
})

// Newest first, unknown dates last; 0 for the same date
const compareDatesDesc = (a: string | null, b: string | null): number => {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? 1 : -1
}

const eventLabel = (eventType: EventType, isSurface: boolean): string => {
  // Typed as possibly missing: the API can be ahead of this frontend's types
  const label: string | undefined =
    (isSurface ? SURFACE_EVENT_LABELS[eventType] : undefined) ??
    EVENT_LABELS[eventType]
  return label ?? UNKNOWN_EVENT_LABEL
}

const eventSource = ({
  sourceType,
  sourceId,
}: ComponentEvent): string | null => {
  // Typed as possibly missing: the API can be ahead of this frontend's types
  const label: string | undefined = SOURCE_LABELS[sourceType]
  if (!label) return null
  // A manual entry has no source record to name
  if (sourceType === 'MANUAL' || !sourceId) return label
  return `${label} ${sourceId}`
}

const eventNote = ({ eventType, note }: ComponentEvent): string | null => {
  if (eventType !== 'INSPECTED' || !note) return note
  const condition = INSPECTION_NOTE_CONDITIONS.get(note)
  return condition ? formatComponentCondition(condition) : note
}

const eventRow = (event: ComponentEvent, isSurface: boolean): HistoryRow => ({
  key: `event-${event.id}`,
  kind: 'event',
  label: eventLabel(event.eventType, isSurface),
  ...withDate(toDay(event.occurredAt)),
  source: eventSource(event),
  place: null,
  actor: event.actor,
  note: eventNote(event),
  isCurrent: false,
})

const knownInstallationDay = (installation: Installation): string | null =>
  isKnownInstallationDate(installation.installationDate)
    ? toDay(installation.installationDate)
    : null

// A deinstallation is newer than its installation, so it comes first
const installationRows = (installation: Installation): HistoryRow[] => {
  const place = describeStructure(
    installation.propertyObject?.propertyStructures?.[0]
  )
  const rows: HistoryRow[] = []

  if (installation.deinstallationDate) {
    rows.push({
      key: `deinstallation-${installation.id}`,
      kind: 'deinstallation',
      label: EVENT_LABELS.DEINSTALLED,
      ...withDate(toDay(installation.deinstallationDate)),
      source: null,
      place,
      actor: null,
      note: null,
      isCurrent: false,
    })
  }

  rows.push({
    key: `installation-${installation.id}`,
    kind: 'installation',
    label: EVENT_LABELS.INSTALLED,
    ...withDate(knownInstallationDay(installation)),
    source: null,
    place,
    actor: null,
    // The imports write 0 for an unknown cost
    note: installation.cost ? formatSek(installation.cost) : null,
    isCurrent: !installation.deinstallationDate,
  })

  return rows
}

// On the same date an event comes before installation rows. Array.prototype.sort
// is stable, so other ties keep input order.
const compareRows = (a: HistoryRow, b: HistoryRow): number =>
  compareDatesDesc(a.date, b.date) ||
  Number(a.kind !== 'event') - Number(b.kind !== 'event')

export function buildComponentHistory(
  installations: Component['componentInstallations'],
  events: ComponentEvent[],
  opts: { isSurface: boolean }
): HistoryRow[] {
  // The API returns installations in no set order. Newest first means that on
  // a same-day move the new installation lands above the old deinstallation.
  const newestInstallationsFirst = [...(installations ?? [])].sort((a, b) =>
    compareDatesDesc(knownInstallationDay(a), knownInstallationDay(b))
  )

  return [
    ...events.map((event) => eventRow(event, opts.isSurface)),
    ...newestInstallationsFirst.flatMap(installationRows),
  ].sort(compareRows)
}

export function getHistorySectionState(
  sources: {
    /** Loaded by id: the only source that includes past installations */
    component: QueryState<Component>
    /** What the caller already has; a list row carries only the active installation */
    fallbackInstallations: Component['componentInstallations']
    events: QueryState<ComponentEvent[]>
  },
  opts: { isSurface: boolean }
): HistorySectionState {
  const { component, fallbackInstallations, events } = sources
  const buildRows = () =>
    buildComponentHistory(
      component.data?.componentInstallations ?? fallbackInstallations,
      // React Query keeps the last data when a refetch fails, so this can be set on error
      events.data ?? [],
      opts
    )

  if (component.isError || events.isError) {
    return { status: 'error', rows: buildRows() }
  }
  if (component.isPending || events.isPending) return { status: 'loading' }

  const rows = buildRows()
  return rows.length ? { status: 'ready', rows } : { status: 'empty' }
}
