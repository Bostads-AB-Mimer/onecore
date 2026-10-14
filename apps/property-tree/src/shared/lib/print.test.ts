// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { printElement } from './print'

describe('printElement', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('marks the element as print target while printing', () => {
    const element = document.createElement('div')
    let markedDuringPrint = false
    vi.spyOn(window, 'print').mockImplementation(() => {
      markedDuringPrint = element.hasAttribute('data-print-target')
    })

    printElement(element)

    expect(window.print).toHaveBeenCalledTimes(1)
    expect(markedDuringPrint).toBe(true)
  })

  it('removes the mark after printing', () => {
    const element = document.createElement('div')
    vi.spyOn(window, 'print').mockImplementation(() => {})

    printElement(element)
    window.dispatchEvent(new Event('afterprint'))

    expect(element.hasAttribute('data-print-target')).toBe(false)
  })
})
