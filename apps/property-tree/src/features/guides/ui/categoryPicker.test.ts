// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GuideCategory } from '@/entities/guide'

import type { EditorCategory } from '../lib/editorState'
import { CategoryPicker } from './CategoryPicker'

const useGuideCategoriesMock = vi.hoisted(() => vi.fn())

vi.mock('@/entities/guide', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/guide')>()),
  useGuideCategories: useGuideCategoriesMock,
}))

const tenfast: GuideCategory = {
  id: 'c1',
  name: 'Tenfast',
  parentId: null,
  createdAt: '',
  updatedAt: '',
}
const contracts: GuideCategory = {
  id: 'c3',
  name: 'Avtal',
  parentId: 'c1',
  createdAt: '',
  updatedAt: '',
}

// Lets React know act() is available outside a test renderer.
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
// The editor state the picker is bound to, and a way to change it from the
// outside like a save does.
let current: EditorCategory | null
let setCurrent: (value: EditorCategory | null) => void

function Harness({ initial }: { initial: EditorCategory | null }) {
  const [value, setValue] = useState(initial)
  current = value
  setCurrent = setValue
  // Inside a form, like in the editor: Radix then renders a native select.
  return createElement(
    'form',
    null,
    createElement(CategoryPicker, { value, onChange: setValue })
  )
}

function render(initial: EditorCategory | null) {
  act(() => {
    root.render(createElement(Harness, { initial }))
  })
}

function setCategories(data: GuideCategory[]) {
  useGuideCategoriesMock.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
  })
}

const triggerText = (id: string) =>
  container.querySelector(`#${id}`)?.textContent?.trim()
const triggerDisabled = (id: string) =>
  container.querySelector<HTMLButtonElement>(`#${id}`)?.disabled

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  setCategories([tenfast, contracts])
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('CategoryPicker', () => {
  it('lets a new guide pick a category', () => {
    render(null)

    expect(triggerDisabled('guide-category')).toBe(false)
  })

  it('shows the parent and the subcategory of a saved guide', () => {
    render({ id: 'c3' })

    expect(triggerText('guide-category')).toBe('Tenfast')
    expect(triggerText('guide-subcategory')).toBe('Avtal')
  })

  it('keeps a category the list does not know yet', () => {
    // A save that created the subcategory puts its id in the state before
    // the category list has been refetched.
    setCategories([tenfast])
    render({ name: 'Avtal', parentId: 'c1' })
    act(() => setCurrent({ id: 'c3' }))

    expect(current).toEqual({ id: 'c3' })

    setCategories([tenfast, contracts])
    render({ id: 'c3' })

    expect(current).toEqual({ id: 'c3' })
    expect(triggerText('guide-category')).toBe('Tenfast')
    expect(triggerText('guide-subcategory')).toBe('Avtal')
  })

  it('keeps a top-level category the list does not know yet', () => {
    setCategories([tenfast])
    render({ name: 'Odoo' })
    act(() => setCurrent({ id: 'c2' }))

    expect(current).toEqual({ id: 'c2' })
    expect(triggerDisabled('guide-category')).toBe(true)
  })
})
