// @vitest-environment jsdom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest'

import {
  downloadFloorplan,
  getFloorplanFileName,
  getFloorplanUrl,
  printFloorplan,
} from './floorplan'

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

describe('getFloorplanFileName', () => {
  it('names the file after the rental', () => {
    expect(getFloorplanFileName(RENTAL_ID)).toBe(
      'bofaktablad-211-001-01-0101.jpg'
    )
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

describe('downloadFloorplan', () => {
  let click: MockInstance<HTMLAnchorElement['click']>
  let open: MockInstance<typeof window.open>
  let downloadedFileName: string | undefined

  beforeEach(() => {
    downloadedFileName = undefined
    window.URL.createObjectURL = vi.fn(() => 'blob:floorplan')
    window.URL.revokeObjectURL = vi.fn()
    click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedFileName = this.download
      })
    open = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('saves the fetched image under the rental file name', async () => {
    const blob = new Blob(['jpg'], { type: 'image/jpeg' })
    const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => blob }))
    vi.stubGlobal('fetch', fetchMock)

    await downloadFloorplan(RENTAL_ID)

    expect(fetchMock).toHaveBeenCalledWith(FLOORPLAN_URL)
    expect(click).toHaveBeenCalledTimes(1)
    expect(downloadedFileName).toBe('bofaktablad-211-001-01-0101.jpg')
    expect(open).not.toHaveBeenCalled()
  })

  it('opens the image in a new tab when the fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )

    await downloadFloorplan(RENTAL_ID)

    expect(click).not.toHaveBeenCalled()
    expect(open).toHaveBeenCalledWith(
      FLOORPLAN_URL,
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('opens the image in a new tab when the CDN answers with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        blob: async () => new Blob(['Not Found']),
      }))
    )

    await downloadFloorplan(RENTAL_ID)

    expect(click).not.toHaveBeenCalled()
    expect(open).toHaveBeenCalledTimes(1)
  })
})
