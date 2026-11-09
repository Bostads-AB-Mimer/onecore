import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import 'yet-another-react-lightbox/plugins/counter.css'

import type { ReactNode } from 'react'
import YetAnotherLightbox from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'

export interface LightboxSlide {
  src: string
  alt: string
  description?: string | null
}

interface LightboxProps {
  open: boolean
  index: number
  slides: LightboxSlide[]
  onClose: () => void
  /**
   * Enables zooming up to this multiple of the image's own pixels. The library
   * default of 1 leaves almost no zoom for images about as large as the screen.
   */
  maxZoomPixelRatio?: number
  /** Shows the "2 / 7" position, and stops at the ends instead of looping. */
  showCounter?: boolean
  /** Extra buttons, shown before the close button. */
  toolbarButtons?: ReactNode[]
}

const LABELS = {
  Previous: 'Föregående',
  Next: 'Nästa',
  Close: 'Stäng',
  'Zoom in': 'Zooma in',
  'Zoom out': 'Zooma ut',
  Lightbox: 'Bildvisare',
  Carousel: 'Bildkarusell',
  'Photo gallery': 'Bildgalleri',
  Slide: 'Bild',
  '{index} of {total}': '{index} av {total}',
}

/** Full-screen image viewer with keyboard navigation and Esc to close. */
export function Lightbox({
  open,
  index,
  slides,
  onClose,
  maxZoomPixelRatio,
  showCounter = false,
  toolbarButtons = [],
}: LightboxProps) {
  const hasZoom = maxZoomPixelRatio !== undefined
  const hasCounter = showCounter && slides.length > 1

  return (
    <YetAnotherLightbox
      open={open}
      index={index}
      close={onClose}
      labels={LABELS}
      plugins={[
        Captions,
        ...(hasZoom ? [Zoom] : []),
        ...(hasCounter ? [Counter] : []),
      ]}
      slides={slides.map((slide) => ({
        src: slide.src,
        alt: slide.alt,
        description: slide.description ?? undefined,
      }))}
      controller={{ closeOnBackdropClick: true }}
      zoom={hasZoom ? { maxZoomPixelRatio, scrollToZoom: true } : undefined}
      carousel={hasCounter ? { finite: true } : undefined}
      toolbar={{ buttons: [...toolbarButtons, 'close'] }}
      render={{
        iconError: () => (
          <span className="text-sm text-white">Bilden kunde inte visas</span>
        ),
        // A single image needs no prev/next buttons.
        ...(slides.length <= 1 && {
          buttonPrev: () => null,
          buttonNext: () => null,
        }),
      }}
    />
  )
}
