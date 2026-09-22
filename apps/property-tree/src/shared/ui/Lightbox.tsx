import 'yet-another-react-lightbox/styles.css'

import YetAnotherLightbox from 'yet-another-react-lightbox'

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
      slides={slides.map((slide) => ({
        src: slide.src,
        alt: slide.alt,
        title: slide.description ?? undefined,
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
