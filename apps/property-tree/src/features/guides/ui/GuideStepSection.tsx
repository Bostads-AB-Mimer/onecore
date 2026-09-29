import { useState } from 'react'
import { Link2 } from 'lucide-react'

import type { GuideStepWithUrls } from '@/entities/guide'

import { sanitizeGuideHtml } from '@/shared/lib/sanitizeHtml'
import { cn } from '@/shared/lib/utils'
import { Callout } from '@/shared/ui/Callout'
import { Lightbox } from '@/shared/ui/Lightbox'

import { stepAnchorId } from '../lib/stepAnchor'

interface GuideStepSectionProps {
  step: GuideStepWithUrls
  stepNumber: number
  variant: 'page' | 'sheet'
  highlighted?: boolean
  onCopyLink?: (stepNumber: number) => void
}

const bodyClassName =
  'text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_a]:text-primary [&_a]:underline'

export function GuideStepSection({
  step,
  stepNumber,
  variant,
  highlighted = false,
  onCopyLink,
}: GuideStepSectionProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const images = step.images.filter((image) => image.url)

  return (
    <section
      // Only the page variant is linked to (hash links, table of contents).
      // The sheet can be open on top of a guide page, where the same ids
      // would otherwise appear twice.
      id={variant === 'page' ? stepAnchorId(stepNumber) : undefined}
      data-step-anchor
      className={cn(
        'scroll-mt-20 rounded-lg border bg-card p-4 transition-colors duration-1000 sm:p-5',
        highlighted && 'bg-primary/5 border-primary/40'
      )}
    >
      <div className="group flex items-start gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          aria-hidden
        >
          {stepNumber}
        </span>
        <h2 className="text-lg font-semibold leading-7">
          <span className="sr-only">Steg {stepNumber}: </span>
          {step.title}
        </h2>
        {onCopyLink && (
          <button
            type="button"
            onClick={() => onCopyLink(stepNumber)}
            className="ml-auto rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
            aria-label={`Kopiera länk till steg ${stepNumber}`}
            title="Kopiera länk till steget"
          >
            <Link2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {step.body && (
        <div
          className={cn(bodyClassName, 'mt-3')}
          dangerouslySetInnerHTML={{ __html: sanitizeGuideHtml(step.body) }}
        />
      )}

      {images.length > 0 && (
        <ul
          className={cn(
            'mt-4 grid gap-3',
            variant === 'page' && images.length > 1
              ? 'sm:grid-cols-2'
              : 'grid-cols-1'
          )}
        >
          {images.map((image, index) => (
            <li key={image.id}>
              <figure>
                {/* The container reserves height so a lazily loaded image
                    cannot shift the page after a hash link scrolled here. */}
                <button
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="block min-h-[12rem] w-full overflow-hidden rounded-md border bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Förstora bild: ${image.altText || image.filename}`}
                >
                  <img
                    src={image.url}
                    alt={image.altText}
                    loading="lazy"
                    className="w-full object-contain max-h-80"
                  />
                </button>
                {image.caption && (
                  <figcaption className="mt-1 text-xs text-muted-foreground">
                    {image.caption}
                  </figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
      )}

      {step.calloutType && step.calloutText && (
        <Callout type={step.calloutType} className="mt-4">
          {step.calloutText}
        </Callout>
      )}

      <Lightbox
        open={lightboxIndex !== null}
        index={lightboxIndex ?? 0}
        slides={images.map((image) => ({
          src: image.url,
          alt: image.altText,
          description: image.caption,
        }))}
        onClose={() => setLightboxIndex(null)}
      />
    </section>
  )
}
