// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MultiSelectSearchFilterDropdown,
  type SearchFilterOption,
} from './MultiSelectSearchFilterDropdown'

// Lets React know act() is available outside a test renderer.
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Props = Parameters<typeof MultiSelectSearchFilterDropdown>[0]

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const ERROR_TEXT = 'Sökningen misslyckades. Försök igen.'
const RAW_ERROR = 'Request failed with status code 500: upstream timeout'

const annOption: SearchFilterOption = { value: 'p1', label: 'Ann Berg' }
const annaOption: SearchFilterOption = { value: 'p2', label: 'Anna Ek' }

let container: HTMLDivElement
let root: Root
/** Pending searchFn calls, by the query they were made with */
let searches: Map<string, Deferred<SearchFilterOption[]>>
let searchFn: ReturnType<typeof vi.fn<Props['searchFn']>>

function render(props: Partial<Props> = {}) {
  act(() => {
    root.render(
      createElement(MultiSelectSearchFilterDropdown, {
        searchFn,
        selectedValues: [],
        onSelectionChange: vi.fn(),
        placeholder: 'Kvartersvärd',
        ...props,
      })
    )
  })
}

function triggerButton() {
  const button = container.querySelector('button')
  if (!button) throw new Error('No trigger button')
  return button
}

function toggleOpen() {
  act(() => triggerButton().click())
}

function type(text: string) {
  const input = container.querySelector<HTMLInputElement>('input')
  if (!input) throw new Error('No search field')
  // React tracks the value itself; set it through the native setter so the
  // input event is seen as a change.
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set
  act(() => {
    setValue?.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function waitForDebounce() {
  act(() => {
    vi.advanceTimersByTime(300)
  })
}

async function flush() {
  await act(async () => {})
}

async function resolveSearch(query: string, options: SearchFilterOption[]) {
  const search = searches.get(query)
  if (!search) throw new Error(`No search made for "${query}"`)
  search.resolve(options)
  await flush()
}

async function rejectSearch(query: string, reason: unknown) {
  const search = searches.get(query)
  if (!search) throw new Error(`No search made for "${query}"`)
  search.reject(reason)
  await flush()
}

function pressEscape() {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })
}

function optionButton(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(label)
  )
  if (!button) throw new Error(`No option "${label}"`)
  return button
}

beforeEach(() => {
  vi.useFakeTimers()
  // The current implementation logs failed searches; keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  searches = new Map()
  searchFn = vi.fn<Props['searchFn']>((query: string) => {
    const search = deferred<SearchFilterOption[]>()
    searches.set(query, search)
    return search.promise
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('MultiSelectSearchFilterDropdown search', () => {
  it('shows its own error message when the search fails, not "no results" or the server text', async () => {
    render()
    toggleOpen()
    type('Ann')
    waitForDebounce()

    await rejectSearch('Ann', new Error(RAW_ERROR))

    expect(container.textContent).toContain(ERROR_TEXT)
    expect(container.textContent).not.toContain('Inga resultat')
    expect(container.textContent).not.toContain(RAW_ERROR)
  })

  // Guard: already passes; keeps an empty result from being shown as an error.
  it('shows "no results" for a search that finds nothing', async () => {
    render()
    toggleOpen()
    type('Ann')
    waitForDebounce()

    await resolveSearch('Ann', [])

    expect(container.textContent).toContain('Inga resultat')
    expect(container.textContent).not.toContain(ERROR_TEXT)
  })

  it('drops the error once a new search succeeds', async () => {
    render()
    toggleOpen()
    type('Ann')
    waitForDebounce()
    await rejectSearch('Ann', new Error(RAW_ERROR))
    expect(container.textContent).toContain(ERROR_TEXT)

    type('Anna')
    waitForDebounce()
    await resolveSearch('Anna', [annaOption])

    expect(container.textContent).not.toContain(ERROR_TEXT)
    expect(container.textContent).toContain('Anna Ek')
  })

  it('ignores an older search that answers after a newer one', async () => {
    render()
    toggleOpen()
    type('Ann')
    waitForDebounce()
    type('Anna')
    waitForDebounce()

    await resolveSearch('Anna', [annaOption])
    await resolveSearch('Ann', [annOption])

    expect(container.textContent).toContain('Anna Ek')
    expect(container.textContent).not.toContain('Ann Berg')
  })

  it('hides results for older text while the new text waits for its search', async () => {
    render()
    toggleOpen()
    type('Ann')
    waitForDebounce()
    await resolveSearch('Ann', [annOption])
    expect(container.textContent).toContain('Ann Berg')

    type('Anna')

    expect(container.textContent).not.toContain('Ann Berg')
    expect(container.textContent).not.toContain('Inga resultat')
    expect(container.textContent).not.toContain(ERROR_TEXT)
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('never shows the spinner next to old results when the text goes back to an earlier search', async () => {
    render()
    toggleOpen()
    type('Ann')
    waitForDebounce()
    await resolveSearch('Ann', [annOption])

    // A letter typed and erased again while the search for it still runs
    type('Anna')
    waitForDebounce()
    type('Ann')

    const spinnerShown = container.querySelector('.animate-spin') !== null
    const oldOptionsShown = container.textContent?.includes('Ann Berg') ?? false
    expect({ spinnerShown, oldOptionsShown }).not.toEqual({
      spinnerShown: true,
      oldOptionsShown: true,
    })
  })

  // Guard: already passes; ignoring a search that answers after closing must
  // not leave the spinner stuck when the dropdown opens again.
  it('shows no spinner, options or error after reopening when a search answered while closed', async () => {
    render()
    toggleOpen()
    type('Ann')
    waitForDebounce()

    pressEscape()
    await resolveSearch('Ann', [annOption])
    waitForDebounce()
    toggleOpen()

    expect(container.querySelector('input')).not.toBeNull()
    expect(container.querySelector('.animate-spin')).toBeNull()
    expect(container.textContent).not.toContain('Ann Berg')
    expect(container.textContent).not.toContain(ERROR_TEXT)
  })
})

describe('MultiSelectSearchFilterDropdown chosen value names', () => {
  it('names a chosen value from a saved link on the button and in the chosen list', async () => {
    const resolveLabels = vi.fn(async (_values: string[]) => [
      { value: 'u1', label: 'Anna Svensson' },
    ])
    render({ selectedValues: ['u1'], resolveLabels })
    await flush()

    expect(triggerButton().textContent).toBe('Anna Svensson')

    toggleOpen()

    expect(container.textContent).toContain('Anna Svensson')
    expect(container.textContent).not.toContain('u1')
    expect(resolveLabels).toHaveBeenCalledWith(['u1'])
  })

  it('says it is loading while the name is looked up', async () => {
    const lookup = deferred<SearchFilterOption[]>()
    render({ selectedValues: ['u1'], resolveLabels: () => lookup.promise })
    await flush()

    expect(triggerButton().textContent).toBe('Laddar…')
    expect(container.textContent).not.toContain('u1')
  })

  it('says the name is unknown when the lookup does not find the value', async () => {
    render({ selectedValues: ['gone'], resolveLabels: async () => [] })
    await flush()

    expect(triggerButton().textContent).toBe('Okänt namn')
    expect(container.textContent).not.toContain('gone')
  })

  it('says the name could not be fetched when the lookup fails', async () => {
    render({
      selectedValues: ['u1'],
      resolveLabels: async () => {
        throw new Error(RAW_ERROR)
      },
    })
    await flush()

    expect(triggerButton().textContent).toBe('Kunde inte hämta namn')
    expect(container.textContent).not.toContain('u1')
    expect(container.textContent).not.toContain(RAW_ERROR)
  })

  it('does not look up a value picked from the search results', async () => {
    const resolveLabels = vi.fn(async (_values: string[]) => [
      { value: 'u1', label: 'Anna Svensson' },
    ])
    const onSelectionChange = vi.fn()
    render({ selectedValues: ['u1'], resolveLabels, onSelectionChange })
    await flush()
    toggleOpen()
    type('Ann')
    waitForDebounce()
    await resolveSearch('Ann', [annOption])

    act(() => optionButton('Ann Berg').click())
    expect(onSelectionChange).toHaveBeenCalledWith(['u1', 'p1'])
    render({
      selectedValues: ['u1', 'p1'],
      resolveLabels,
      onSelectionChange,
    })
    await flush()

    expect(resolveLabels).toHaveBeenCalledTimes(1)
    expect(resolveLabels).toHaveBeenCalledWith(['u1'])
  })

  it('looks up a value only once across re-renders', async () => {
    const resolveLabels = vi.fn(async (_values: string[]) => [
      { value: 'u1', label: 'Anna Svensson' },
    ])
    render({ selectedValues: ['u1'], resolveLabels })
    await flush()
    render({ selectedValues: ['u1'], resolveLabels })
    await flush()
    render({ selectedValues: ['u1'], resolveLabels })
    await flush()

    expect(resolveLabels).toHaveBeenCalledTimes(1)
    expect(triggerButton().textContent).toBe('Anna Svensson')
  })

  it('looks the name up again when the dropdown is opened after a failed lookup', async () => {
    const resolveLabels = vi
      .fn<(values: string[]) => Promise<SearchFilterOption[]>>()
      .mockRejectedValueOnce(new Error(RAW_ERROR))
      .mockResolvedValueOnce([{ value: 'u1', label: 'Anna Svensson' }])
    render({ selectedValues: ['u1'], resolveLabels })
    await flush()
    expect(triggerButton().textContent).toBe('Kunde inte hämta namn')

    toggleOpen()
    await flush()

    expect(resolveLabels).toHaveBeenCalledTimes(2)
    expect(resolveLabels).toHaveBeenLastCalledWith(['u1'])
    expect(triggerButton().textContent).toBe('Anna Svensson')
    expect(container.textContent).not.toContain('Kunde inte hämta namn')
  })

  // Guard: already passes; a value removed and brought back (e.g. browser
  // back) must be looked up again, not stay on "Laddar…".
  it('looks a value up again when it is removed and later brought back', async () => {
    const resolveLabels = vi.fn(async (_values: string[]) => [
      { value: 'u1', label: 'Anna Svensson' },
    ])
    const onSelectionChange = vi.fn()
    render({ selectedValues: ['u1'], resolveLabels, onSelectionChange })
    await flush()
    toggleOpen()

    // The remove button next to the chosen value is the one inside its row
    const removeButton =
      container.querySelector<HTMLButtonElement>('.bg-accent button')
    if (!removeButton) throw new Error('No remove button')
    act(() => removeButton.click())
    expect(onSelectionChange).toHaveBeenCalledWith([])
    render({ selectedValues: [], resolveLabels, onSelectionChange })
    await flush()
    pressEscape()

    render({ selectedValues: ['u1'], resolveLabels, onSelectionChange })
    await flush()

    expect(resolveLabels).toHaveBeenCalledTimes(2)
    expect(resolveLabels).toHaveBeenLastCalledWith(['u1'])
    expect(triggerButton().textContent).toBe('Anna Svensson')
  })

  // Guard: already passes; an answer dropped because the selection changed
  // must not leave those values on "Laddar…".
  it('names the values whose answer was dropped when the selection changed mid-lookup', async () => {
    const lookups: Deferred<SearchFilterOption[]>[] = []
    const resolveLabels = vi.fn((_values: string[]) => {
      const lookup = deferred<SearchFilterOption[]>()
      lookups.push(lookup)
      return lookup.promise
    })
    render({ selectedValues: ['u1'], resolveLabels })
    await flush()
    render({ selectedValues: ['u1', 'u2'], resolveLabels })
    await flush()

    // The first answer comes after the selection changed and is dropped
    lookups[0].resolve([{ value: 'u1', label: 'Anna Svensson' }])
    await flush()
    const latest = lookups[lookups.length - 1]
    latest.resolve([
      { value: 'u1', label: 'Anna Svensson' },
      { value: 'u2', label: 'Bo Ek' },
    ])
    await flush()
    toggleOpen()

    expect(resolveLabels).toHaveBeenLastCalledWith(['u1', 'u2'])
    expect(container.textContent).toContain('Anna Svensson')
    expect(container.textContent).toContain('Bo Ek')
    expect(container.textContent).not.toContain('Laddar…')
  })

  // Guard: already passes; filters without a resolver keep showing the value.
  it('shows the value itself when there is no name lookup', () => {
    render({ selectedValues: ['ABC 1:2'] })

    expect(triggerButton().textContent).toBe('ABC 1:2')
  })
})
