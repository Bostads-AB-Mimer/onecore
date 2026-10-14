// Floorplans (planritningar) for Mimer's residences are served from a public
// CDN at pub.mimer.nu, keyed by the Xpand rentalId (e.g. "211-001-01-0101").
// The CDN is open — no auth or core-service proxy is involved — so callers
// just need to construct the URL and render it as an <img>, handling the
// onError case when a given rental has no published floorplan.
const FLOORPLAN_CDN_BASE = 'https://pub.mimer.nu/bofaktablad/bofaktablad'

const PRINT_FRAME_ID = 'floorplan-print-frame'

const PRINT_STYLES = `
  @page { margin: 10mm; }
  html, body { margin: 0; }
  img { display: block; max-width: 100%; max-height: 100vh; margin: 0 auto; }
`

export const getFloorplanUrl = (rentalId: string): string =>
  `${FLOORPLAN_CDN_BASE}/${rentalId}.jpg`

// Prints only the floorplan by loading it into a hidden iframe and printing
// that frame. An iframe (instead of window.open) is not stopped by popup
// blockers and leaves the rest of the page out of the printout.
export const printFloorplan = (rentalId: string): void => {
  document.getElementById(PRINT_FRAME_ID)?.remove()

  const iframe = document.createElement('iframe')
  iframe.id = PRINT_FRAME_ID
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
  })
  document.body.appendChild(iframe)

  const frameWindow = iframe.contentWindow
  const frameDocument = iframe.contentDocument
  if (!frameWindow || !frameDocument) {
    iframe.remove()
    return
  }

  frameDocument.title = `Bofaktablad ${rentalId}`
  const style = frameDocument.createElement('style')
  style.textContent = PRINT_STYLES
  frameDocument.head.appendChild(style)

  const image = frameDocument.createElement('img')
  image.alt = 'Bofaktablad'
  image.onload = () => {
    frameWindow.focus()
    frameWindow.print()
  }
  image.onerror = () => iframe.remove()
  frameWindow.addEventListener('afterprint', () => iframe.remove())

  image.src = getFloorplanUrl(rentalId)
  frameDocument.body.appendChild(image)
}
