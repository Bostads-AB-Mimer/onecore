import { useCallback, useMemo, useReducer, useRef } from 'react'

/** How much of the current page is selected; drives the header checkbox. */
export type PageSelectionState = 'none' | 'some' | 'all'

/** What a bulk action acts on. `include` lists the rows; `exclude` means the
 * whole query minus the listed rows, so the action re-runs it server-side. */
export type SelectionTarget<T> =
  | { mode: 'include'; ids: string[]; rows: T[] }
  | { mode: 'exclude'; excludedIds: string[]; excludedRows: T[] }

export interface RowSelection<T> {
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  toggleRange: (id: string) => void // shift-click: the clicked row's new state applied from the last click to it
  togglePage: () => void // ticks the whole current page, or unticks it when fully ticked
  clear: () => void
  set: (rows: readonly T[]) => void // replaces the selection with these rows (include mode)
  selectAllResults: () => void // switches to exclude mode; needs totalCount for count
  mode: SelectionTarget<T>['mode']
  target: SelectionTarget<T>
  count: number // rows in include mode; totalCount minus exclusions in exclude mode
  pageState: PageSelectionState
  selectedRows: T[] // rows known to be selected; in exclude mode only those seen so far
}

export interface UseRowSelectionOptions {
  totalCount?: number // results across all pages; the count in exclude mode
}

// Include: exactly these rows. Exclude: everything but these, with the rows
// seen so far kept so consumers can still show something.
type Include<T> = { mode: 'include'; selected: Map<string, T> }
type Exclude<T> = {
  mode: 'exclude'
  seen: Map<string, T>
  excluded: Map<string, T>
}
type State<T> = Include<T> | Exclude<T>

type Page<T> = { rows: readonly T[]; ids: string[] }

/**
 * The slice of the page between the anchor and the target, inclusive, in
 * page order. Just the target when the anchor is not on this page.
 */
export const pageRange = <T>(
  page: Page<T>,
  anchorId: string | null,
  targetId: string
): Page<T> => {
  const targetIndex = page.ids.indexOf(targetId)
  if (targetIndex === -1) return { rows: [], ids: [] }
  const anchorIndex = anchorId === null ? -1 : page.ids.indexOf(anchorId)
  const start =
    anchorIndex === -1 ? targetIndex : Math.min(anchorIndex, targetIndex)
  const end =
    anchorIndex === -1 ? targetIndex : Math.max(anchorIndex, targetIndex)
  return {
    rows: page.rows.slice(start, end + 1),
    ids: page.ids.slice(start, end + 1),
  }
}

type Action<T> =
  | { type: 'toggle'; id: string; row: T | undefined }
  | { type: 'tickPage'; page: Page<T> }
  | { type: 'untickPage'; page: Page<T> }
  | { type: 'clear' }
  | { type: 'set'; page: Page<T> }
  | { type: 'selectAllResults'; page: Page<T> }

const withEntries = <T>(map: Map<string, T>, page: Page<T>) => {
  const next = new Map(map)
  page.ids.forEach((id, i) => next.set(id, page.rows[i]))
  return next
}

const withoutEntries = <T>(map: Map<string, T>, ids: readonly string[]) => {
  const next = new Map(map)
  ids.forEach((id) => next.delete(id))
  return next
}

function includeReducer<T>(state: Include<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case 'toggle': {
      if (state.selected.has(action.id)) {
        return {
          mode: 'include',
          selected: withoutEntries(state.selected, [action.id]),
        }
      }
      if (action.row === undefined) return state
      return {
        mode: 'include',
        selected: new Map(state.selected).set(action.id, action.row),
      }
    }
    case 'tickPage':
      return {
        mode: 'include',
        selected: withEntries(state.selected, action.page),
      }
    case 'untickPage':
      return {
        mode: 'include',
        selected: withoutEntries(state.selected, action.page.ids),
      }
    case 'clear':
      return state.selected.size === 0
        ? state
        : { mode: 'include', selected: new Map() }
    case 'set':
      return { mode: 'include', selected: withEntries(new Map(), action.page) }
    case 'selectAllResults':
      return {
        mode: 'exclude',
        seen: withEntries(new Map(), action.page),
        excluded: new Map(),
      }
  }
}

function excludeReducer<T>(state: Exclude<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case 'toggle': {
      if (state.excluded.has(action.id)) {
        return {
          ...state,
          excluded: withoutEntries(state.excluded, [action.id]),
        }
      }
      if (action.row === undefined) return state
      return {
        mode: 'exclude',
        seen: new Map(state.seen).set(action.id, action.row),
        excluded: new Map(state.excluded).set(action.id, action.row),
      }
    }
    case 'tickPage':
      return {
        mode: 'exclude',
        seen: withEntries(state.seen, action.page),
        excluded: withoutEntries(state.excluded, action.page.ids),
      }
    case 'untickPage':
      return {
        mode: 'exclude',
        seen: withEntries(state.seen, action.page),
        excluded: withEntries(state.excluded, action.page),
      }
    case 'clear':
      return { mode: 'include', selected: new Map() }
    case 'set':
      return { mode: 'include', selected: withEntries(new Map(), action.page) }
    case 'selectAllResults':
      return {
        mode: 'exclude',
        seen: withEntries(state.seen, action.page),
        excluded: new Map(),
      }
  }
}

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
  return state.mode === 'include'
    ? includeReducer(state, action)
    : excludeReducer(state, action)
}

const isSelectedIn = <T>(state: State<T>, id: string) =>
  state.mode === 'include' ? state.selected.has(id) : !state.excluded.has(id)

/** Row selection for a table, in include or exclude mode (see SelectionTarget).
 * Survives page changes on purpose: clear it when the query changes. */
export function useRowSelection<T>(
  rows: readonly T[],
  getId: (row: T) => string,
  options: UseRowSelectionOptions = {}
): RowSelection<T> {
  const [state, dispatch] = useReducer(reducer<T>, undefined, () => ({
    mode: 'include' as const,
    selected: new Map<string, T>(),
  }))

  const pageIds = useMemo(() => rows.map(getId), [rows, getId])
  // Refs keep the callbacks stable while they still see the current page.
  const pageRef = useRef<Page<T>>({ rows, ids: pageIds })
  pageRef.current = { rows, ids: pageIds }

  const isSelected = useCallback(
    (id: string) => isSelectedIn(state, id),
    [state]
  )

  const pageState = useMemo<PageSelectionState>(() => {
    if (pageIds.length === 0) return 'none'
    const onPage = pageIds.filter(isSelected).length
    if (onPage === 0) return 'none'
    return onPage === pageIds.length ? 'all' : 'some'
  }, [pageIds, isSelected])
  const pageStateRef = useRef(pageState)
  pageStateRef.current = pageState

  // Last row clicked on its own; the start of the next shift-click range.
  const anchorRef = useRef<string | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const toggle = useCallback((id: string) => {
    const { rows, ids } = pageRef.current
    const index = ids.indexOf(id)
    anchorRef.current = id
    dispatch({ type: 'toggle', id, row: index >= 0 ? rows[index] : undefined })
  }, [])

  const toggleRange = useCallback((id: string) => {
    const range = pageRange(pageRef.current, anchorRef.current, id)
    if (range.ids.length === 0) return
    const type = isSelectedIn(stateRef.current, id) ? 'untickPage' : 'tickPage'
    anchorRef.current = id
    dispatch({ type, page: range })
  }, [])

  const togglePage = useCallback(() => {
    const type = pageStateRef.current === 'all' ? 'untickPage' : 'tickPage'
    anchorRef.current = null
    dispatch({ type, page: pageRef.current })
  }, [])

  const clear = useCallback(() => {
    anchorRef.current = null
    dispatch({ type: 'clear' })
  }, [])

  const set = useCallback(
    (next: readonly T[]) => {
      anchorRef.current = null
      dispatch({ type: 'set', page: { rows: next, ids: next.map(getId) } })
    },
    [getId]
  )

  const selectAllResults = useCallback(() => {
    anchorRef.current = null
    dispatch({ type: 'selectAllResults', page: pageRef.current })
  }, [])

  const target = useMemo<SelectionTarget<T>>(
    () =>
      state.mode === 'include'
        ? {
            mode: 'include',
            ids: [...state.selected.keys()],
            rows: [...state.selected.values()],
          }
        : {
            mode: 'exclude',
            excludedIds: [...state.excluded.keys()],
            excludedRows: [...state.excluded.values()],
          },
    [state]
  )

  const selectedRows = useMemo(
    () =>
      state.mode === 'include'
        ? [...state.selected.values()]
        : [...state.seen]
            .filter(([id]) => !state.excluded.has(id))
            .map(([, row]) => row),
    [state]
  )

  const count =
    state.mode === 'include'
      ? state.selected.size
      : (options.totalCount ?? state.seen.size) - state.excluded.size

  return {
    isSelected,
    toggle,
    toggleRange,
    togglePage,
    clear,
    set,
    selectAllResults,
    mode: state.mode,
    target,
    count,
    pageState,
    selectedRows,
  }
}
