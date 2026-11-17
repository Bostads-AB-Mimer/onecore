// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BulkActionBar } from './BulkActionBar'

// Lets React know act() is available outside a test renderer.
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function render(includesOtherPages?: boolean) {
  act(() => {
    root.render(
      createElement(BulkActionBar, {
        selectedCount: 3,
        includesOtherPages,
        onClear: vi.fn(),
        onSendSms: vi.fn(),
      })
    )
  })
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

describe('BulkActionBar', () => {
  it('says when the selection includes leases on other pages', () => {
    render(true)

    expect(container.textContent).toContain('3 valda (även på andra sidor)')
  })

  it('shows only the count when everything selected is on this page', () => {
    render(false)

    expect(container.textContent).toContain('3 valda')
    expect(container.textContent).not.toContain('andra sidor')
  })
})
