// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LeaseSearchResult } from '@/services/api/core/leaseSearchService'

import { LeaseMobileCard, LeaseMobileSelectAll } from './LeaseSearchTable'

// Lets React know act() is available outside a test renderer.
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

// Only the fields the card renders; the rest of the schema is irrelevant here.
const lease = {
  leaseId: '123-456-01/1',
  status: 'Current',
  startDate: '2024-01-01',
  lastDebitDate: null,
  address: 'Testgatan 1',
  objectTypeCode: 'BALG',
  contacts: [
    {
      contactCode: 'P123',
      name: 'Test Testsson',
      phone: '0700000000',
      email: null,
    },
  ],
} as unknown as LeaseSearchResult

let container: HTMLDivElement
let root: Root
let pathname: string

function LocationProbe() {
  pathname = useLocation().pathname
  return null
}

function renderCard(checked: boolean, onToggle: () => void) {
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/leases'] },
        createElement(LeaseMobileCard, { lease, checked, onToggle }),
        createElement(LocationProbe)
      )
    )
  })
}

function renderSelectAll(totalCount: number, pageCount: number) {
  const onToggle = vi.fn()
  act(() => {
    root.render(
      createElement(LeaseMobileSelectAll, {
        checked: false,
        onToggle,
        totalCount,
        pageCount,
      })
    )
  })
  return onToggle
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('LeaseMobileCard', () => {
  it('toggles the lease and stays on the page when the checkbox is tapped', () => {
    const onToggle = vi.fn()
    renderCard(false, onToggle)

    const checkbox = container.querySelector<HTMLButtonElement>(
      '[aria-label="Välj 123-456-01/1"]'
    )
    expect(checkbox).not.toBeNull()
    act(() => checkbox!.click())

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(pathname).toBe('/leases')
  })

  it('shows the lease as selected', () => {
    renderCard(true, vi.fn())

    const checkbox = container.querySelector('[aria-label="Välj 123-456-01/1"]')
    expect(checkbox?.getAttribute('data-state')).toBe('checked')
  })
})

describe('LeaseMobileSelectAll', () => {
  it('toggles select all when tapped', () => {
    const onToggle = renderSelectAll(3, 3)

    act(() => container.querySelector<HTMLButtonElement>('button')!.click())

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('says that it selects leases on other pages too', () => {
    renderSelectAll(120, 25)

    expect(container.textContent).toBe(
      'Välj alla 120 träffar (även på andra sidor)'
    )
  })

  it('shows only the count when every hit is on this page', () => {
    renderSelectAll(3, 3)

    expect(container.textContent).toBe('Välj alla 3 träffar')
  })
})
