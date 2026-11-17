// @vitest-environment jsdom
import { act, type ComponentProps, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Pagination } from './Pagination'

// Lets React know act() is available outside a test renderer.
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

const baseProps: ComponentProps<typeof Pagination> = {
  currentPage: 1,
  totalPages: 1,
  totalRecords: 40,
  pageSize: 100,
  onPageChange: vi.fn(),
}

function render(props: Partial<ComponentProps<typeof Pagination>>) {
  act(() => {
    root.render(createElement(Pagination, { ...baseProps, ...props }))
  })
}

const pageSizeTrigger = () =>
  container.querySelector<HTMLButtonElement>('button[aria-labelledby]')
const nextPageButton = () => container.querySelector('[title="Nästa sida"]')

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('Pagination page size selector', () => {
  it('renders nothing on a single page without a page size selector', () => {
    render({})

    expect(container.innerHTML).toBe('')
  })

  it('shows the selector on a single page, without page buttons', () => {
    render({ pageSizeOptions: [50, 100], onPageSizeChange: vi.fn() })

    expect(container.textContent).toContain('Rader per sida')
    expect(pageSizeTrigger()?.textContent).toBe('100')
    expect(nextPageButton()).toBeNull()
  })

  it('shows the selector next to the page buttons on several pages', () => {
    render({
      totalPages: 3,
      totalRecords: 250,
      pageSizeOptions: [50, 100],
      onPageSizeChange: vi.fn(),
    })

    expect(pageSizeTrigger()).not.toBeNull()
    expect(nextPageButton()).not.toBeNull()
  })

  it('renders nothing without results', () => {
    render({
      totalRecords: 0,
      pageSizeOptions: [50, 100],
      onPageSizeChange: vi.fn(),
    })

    expect(container.innerHTML).toBe('')
  })

  it('leaves out the selector without a change handler', () => {
    render({ totalPages: 3, totalRecords: 250, pageSizeOptions: [50, 100] })

    expect(pageSizeTrigger()).toBeNull()
    expect(nextPageButton()).not.toBeNull()
  })
})
