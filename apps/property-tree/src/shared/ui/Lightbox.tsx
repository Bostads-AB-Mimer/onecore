import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'

import YetAnotherLightbox from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'

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
}

/** Full-screen image viewer with keyboard navigation and Esc to close. */
export function Lightbox({ open, index, slides, onClose }: LightboxProps) {
  return (
    <YetAnotherLightbox
      open={open}
      index={index}
      close={onClose}
      plugins={[Captions]}
      slides={slides.map((slide) => ({
        src: slide.src,
        alt: slide.alt,
        description: slide.description ?? undefined,
      }))}
      controller={{ closeOnBackdropClick: true }}
      // A single image needs no prev/next buttons.
      render={
        slides.length <= 1
          ? { buttonPrev: () => null, buttonNext: () => null }
          : undefined
      }
    />
  )
}
