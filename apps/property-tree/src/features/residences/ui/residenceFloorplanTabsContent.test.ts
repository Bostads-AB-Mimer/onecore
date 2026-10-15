// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as floorplan from '@/shared/lib/floorplan'
import * as print from '@/shared/lib/print'

import { ResidenceFloorplanTabsContent } from './ResidenceFloorplanTabsContent'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const findButton = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === label
  )

const findOpenLink = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('a')).find(
    (link) => link.textContent === 'Öppna'
  )

const fireImageEvent = (container: HTMLElement, type: 'load' | 'error') =>
  act(() => {
    container.querySelector('img')!.dispatchEvent(new Event(type))
  })

describe('ResidenceFloorplanTabsContent', () => {
  let container: HTMLDivElement
  let root: Root

  const render = (rentalId: string) =>
    act(() => {
      root.render(createElement(ResidenceFloorplanTabsContent, { rentalId }))
    })

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('hides the buttons until the floorplan has loaded', () => {
    render('211-001-01-0101')

    expect(findButton(container, 'Skriv ut')).toBeUndefined()
    expect(findOpenLink(container)).toBeUndefined()

    fireImageEvent(container, 'load')

    expect(findButton(container, 'Skriv ut')).toBeDefined()
    expect(findOpenLink(container)).toBeDefined()
  })

  it('shows no buttons when the residence has no floorplan', () => {
    render('211-001-01-0101')
    fireImageEvent(container, 'error')

    expect(container.querySelector('img')).toBeNull()
    expect(findButton(container, 'Skriv ut')).toBeUndefined()
    expect(findOpenLink(container)).toBeUndefined()
  })

  it('hides the buttons again while another residence is loading', () => {
    render('211-001-01-0101')
    fireImageEvent(container, 'load')

    render('211-001-01-0102')

    expect(findButton(container, 'Skriv ut')).toBeUndefined()
  })

  it('shows the floorplan of a newly selected residence after a missing one', () => {
    render('211-001-01-0101')
    fireImageEvent(container, 'error')

    render('211-001-01-0102')

    expect(container.querySelector('img')?.src).toBe(
      floorplan.getFloorplanUrl('211-001-01-0102')
    )
  })

  it('prints only the floorplan', () => {
    const printElement = vi
      .spyOn(print, 'printElement')
      .mockImplementation(() => {})

    render('211-001-01-0101')
    fireImageEvent(container, 'load')

    act(() => findButton(container, 'Skriv ut')!.click())

    expect(printElement).toHaveBeenCalledTimes(1)
    const target = printElement.mock.calls[0][0]
    expect(target.querySelector('img')?.src).toBe(
      floorplan.getFloorplanUrl('211-001-01-0101')
    )
    expect(target.querySelector('button')).toBeNull()
  })

  it('links to the selected residence floorplan in a new tab', () => {
    render('211-001-01-0101')
    fireImageEvent(container, 'load')

    const link = findOpenLink(container)!
    expect(link.href).toBe(floorplan.getFloorplanUrl('211-001-01-0101'))
    expect(link.target).toBe('_blank')
    expect(link.rel).toBe('noopener noreferrer')
  })
})
