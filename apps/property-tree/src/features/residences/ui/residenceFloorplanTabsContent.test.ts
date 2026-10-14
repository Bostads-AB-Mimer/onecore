// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as floorplan from '@/shared/lib/floorplan'

import { ResidenceFloorplanTabsContent } from './ResidenceFloorplanTabsContent'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const findButton = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === label
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
    expect(findButton(container, 'Spara')).toBeUndefined()

    fireImageEvent(container, 'load')

    expect(findButton(container, 'Skriv ut')).toBeDefined()
    expect(findButton(container, 'Spara')).toBeDefined()
  })

  it('shows no buttons when the residence has no floorplan', () => {
    render('211-001-01-0101')
    fireImageEvent(container, 'error')

    expect(container.querySelector('img')).toBeNull()
    expect(findButton(container, 'Skriv ut')).toBeUndefined()
    expect(findButton(container, 'Spara')).toBeUndefined()
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

  it('prints and saves the selected residence', async () => {
    const print = vi
      .spyOn(floorplan, 'printFloorplan')
      .mockImplementation(() => {})
    const download = vi
      .spyOn(floorplan, 'downloadFloorplan')
      .mockResolvedValue()

    render('211-001-01-0101')
    fireImageEvent(container, 'load')

    act(() => findButton(container, 'Skriv ut')!.click())
    await act(async () => findButton(container, 'Spara')!.click())

    expect(print).toHaveBeenCalledWith('211-001-01-0101')
    expect(download).toHaveBeenCalledWith('211-001-01-0101')
  })
})
