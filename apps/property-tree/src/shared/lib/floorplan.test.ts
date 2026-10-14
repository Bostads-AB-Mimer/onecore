// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getFloorplanUrl, printFloorplan } from './floorplan'

const RENTAL_ID = '211-001-01-0101'
const FLOORPLAN_URL =
  'https://pub.mimer.nu/bofaktablad/bofaktablad/211-001-01-0101.jpg'

const getPrintFrame = () =>
  document.getElementById('floorplan-print-frame') as HTMLIFrameElement | null

describe('getFloorplanUrl', () => {
  it('points at the rental on the CDN', () => {
    expect(getFloorplanUrl(RENTAL_ID)).toBe(FLOORPLAN_URL)
  })
})

describe('printFloorplan', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('loads only the floorplan into a hidden frame', () => {
    printFloorplan(RENTAL_ID)

    const frame = getPrintFrame()
    expect(frame).not.toBeNull()
    expect(frame!.style.width).toBe('0px')
    expect(frame!.style.height).toBe('0px')

    const images = frame!.contentDocument!.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].src).toBe(FLOORPLAN_URL)
  })

  it('prints the frame once the image has loaded', () => {
    printFloorplan(RENTAL_ID)

    const frame = getPrintFrame()!
    const print = vi
      .spyOn(frame.contentWindow!, 'print')
      .mockImplementation(() => {})

    expect(print).not.toHaveBeenCalled()
    frame
      .contentDocument!.querySelector('img')!
      .dispatchEvent(new Event('load'))
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('removes the frame after printing', () => {
    printFloorplan(RENTAL_ID)

    getPrintFrame()!.contentWindow!.dispatchEvent(new Event('afterprint'))
    expect(getPrintFrame()).toBeNull()
  })

  it('removes the frame if the image fails to load', () => {
    printFloorplan(RENTAL_ID)

    getPrintFrame()!
      .contentDocument!.querySelector('img')!
      .dispatchEvent(new Event('error'))
    expect(getPrintFrame()).toBeNull()
  })

  it('replaces a frame left over from an earlier print', () => {
    printFloorplan(RENTAL_ID)
    printFloorplan(RENTAL_ID)

    expect(document.querySelectorAll('#floorplan-print-frame')).toHaveLength(1)
  })
})
