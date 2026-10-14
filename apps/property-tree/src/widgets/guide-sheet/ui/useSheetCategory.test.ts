// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSheetCategory } from './useSheetCategory'

// Lets React know act() is available outside a test renderer.
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const tenfast = { id: 'c1', name: 'Tenfast' }

type Props = { isOpen: boolean; slug: string | null }

let container: HTMLDivElement
let root: Root
let current: ReturnType<typeof useSheetCategory>

function Probe(props: Props) {
  current = useSheetCategory(props)
  return null
}

function render(props: Props) {
  act(() => root.render(createElement(Probe, props)))
}

beforeEach(() => {
  container = document.createElement('div')
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
})

describe('useSheetCategory', () => {
  it('keeps the category when going back from a guide opened from its list', () => {
    render({ isOpen: true, slug: null })
    act(() => current.selectCategory(tenfast))
    act(() => current.markGuideListed('registrera-uppsagning'))
    render({ isOpen: true, slug: 'registrera-uppsagning' })
    render({ isOpen: true, slug: null })

    expect(current.category).toEqual(tenfast)
  })

  it('shows all categories after a guide opened from outside the list', () => {
    render({ isOpen: true, slug: null })
    act(() => current.selectCategory(tenfast))
    render({ isOpen: true, slug: 'felanmalan-i-odoo' })
    render({ isOpen: true, slug: null })

    expect(current.category).toBeNull()
  })

  it('keeps the category while closing and resets it on reopen', () => {
    render({ isOpen: true, slug: null })
    act(() => current.selectCategory(tenfast))

    // Unchanged while the sheet animates out.
    render({ isOpen: false, slug: null })
    expect(current.category).toEqual(tenfast)

    render({ isOpen: true, slug: null })
    expect(current.category).toBeNull()
  })

  it('goes back to all categories on clear', () => {
    render({ isOpen: true, slug: null })
    act(() => current.selectCategory(tenfast))
    act(() => current.clearCategory())

    expect(current.category).toBeNull()
  })
})
