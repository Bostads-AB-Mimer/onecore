import { useState } from 'react'
import { ChevronRight, ExternalLink } from 'lucide-react'

import type { ResidenceMedia } from '@/services/types'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Lightbox } from '@/shared/ui/Lightbox'
import { Skeleton } from '@/shared/ui/Skeleton'

import { useResidenceMedia } from '../hooks/useResidenceMedia'

// The side-by-side layout and these variants share the @container and its
// breakpoint in ResidenceBasicInfo. Below it, the images form a swipeable row.
const THUMBNAILS_IN_WIDE_LAYOUT = 4
const PHOTO_MAX_ZOOM_PIXEL_RATIO = 2
// Energy declarations are scanned documents, where reading the text needs more
// zoom than looking at a photo.
const ENERGY_DECLARATION_MAX_ZOOM_PIXEL_RATIO = 3

interface ResidenceMediaCardProps {
  rentalId: string
  address: string
}

export const ResidenceMediaCard = ({
  rentalId,
  address,
}: ResidenceMediaCardProps) => {
  const { data, isPending, isError, refetch } = useResidenceMedia(rentalId)

  if (isPending) return <ResidenceMediaCardSkeleton />

  if (isError) {
    return (
      <Card className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm">Bilderna kunde inte hämtas.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Försök igen
        </Button>
      </Card>
    )
  }

  return <ResidenceMediaContent media={data} address={address} />
}

const ResidenceMediaCardSkeleton = () => (
  <Card className="h-full space-y-2 p-4" role="status">
    <span className="sr-only">Laddar bilder</span>
    <Skeleton className="aspect-[3/2] max-h-36 w-full @[1000px]:max-h-none" />
    <div className="hidden grid-cols-3 gap-2 @[1000px]:grid">
      <Skeleton className="aspect-[3/2]" />
      <Skeleton className="aspect-[3/2]" />
      <Skeleton className="aspect-[3/2]" />
    </div>
  </Card>
)

interface ResidenceMediaContentProps {
  media: ResidenceMedia
  address: string
}

const ResidenceMediaContent = ({
  media,
  address,
}: ResidenceMediaContentProps) => {
  const [brokenFiles, setBrokenFiles] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [energyDeclarationOpen, setEnergyDeclarationOpen] = useState(false)

  const markAsBroken = (url: string) =>
    setBrokenFiles((current) => [...current, url])

  const images = media.images.filter((url) => !brokenFiles.includes(url))
  const energyDeclarationUrl =
    media.energyDeclarationUrl &&
    !brokenFiles.includes(media.energyDeclarationUrl)
      ? media.energyDeclarationUrl
      : null
  const isShared = media.imageLevel === 'shared' && images.length > 0
  const hasImages = images.length > 0
  const hiddenImageCount = images.length - THUMBNAILS_IN_WIDE_LAYOUT

  if (!hasImages && !energyDeclarationUrl) return null

  return (
    <Card
      // Without images the card holds a single row, so it shouldn't stretch to
      // the height of the card next to it.
      className={cn(
        'flex flex-col gap-3 p-4',
        hasImages ? 'h-full' : 'self-start'
      )}
      aria-label={hasImages ? 'Bilder' : 'Energideklaration'}
      role="region"
    >
      {hasImages && (
        <h2 className="hidden text-lg font-semibold @[1000px]:block">Bilder</h2>
      )}

      {isShared && (
        <p className="text-xs text-muted-foreground">
          Delade bilder. Kan visa byggnaden, inte just den här lägenheten.
        </p>
      )}

      {hasImages && (
        <ul className="-m-0.5 flex snap-x gap-2 overflow-x-auto p-0.5 @[1000px]:grid @[1000px]:grid-cols-3 @[1000px]:overflow-visible">
          {images.map((url, index) => (
            <li
              key={url}
              className={cn(
                'h-36 w-56 shrink-0 snap-start @[1000px]:h-auto @[1000px]:w-auto',
                images.length === 1 && 'w-full',
                index === 0 && '@[1000px]:col-span-3',
                index >= THUMBNAILS_IN_WIDE_LAYOUT && '@[1000px]:hidden'
              )}
            >
              <button
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="relative block h-full w-full overflow-hidden rounded-md bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 @[1000px]:aspect-[3/2] @[1000px]:h-auto"
                aria-label={`Visa bild ${index + 1} för ${address} i större format`}
              >
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => markAsBroken(url)}
                  className="h-full w-full object-cover"
                />
                {hiddenImageCount > 0 &&
                  index === THUMBNAILS_IN_WIDE_LAYOUT - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 hidden items-center justify-center bg-black/60 text-sm font-medium text-white @[1000px]:flex"
                    >
                      +{hiddenImageCount}
                    </span>
                  )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {energyDeclarationUrl && (
        <button
          type="button"
          onClick={() => setEnergyDeclarationOpen(true)}
          className={cn(
            'flex min-h-12 w-full items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            hasImages && 'mt-auto border-t pt-3'
          )}
          aria-label="Öppna energideklarationen, bild av dokument"
        >
          <img
            src={energyDeclarationUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => markAsBroken(energyDeclarationUrl)}
            className="h-12 w-[34px] shrink-0 rounded-sm border bg-white object-cover object-top"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Energideklaration</span>
            <span className="block text-xs text-muted-foreground">
              Gemensam för flera lägenheter
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      <Lightbox
        open={lightboxIndex !== null}
        index={lightboxIndex ?? 0}
        slides={images.map((url, index) => ({
          src: url,
          alt: `Bild ${index + 1} för ${address}${isShared ? ' (delad bild, kan visa byggnaden)' : ''}`,
          description: isShared
            ? 'Delad bild. Kan visa byggnaden, inte just den här lägenheten.'
            : undefined,
        }))}
        onClose={() => setLightboxIndex(null)}
        maxZoomPixelRatio={PHOTO_MAX_ZOOM_PIXEL_RATIO}
        showCounter
      />

      {energyDeclarationUrl && (
        // A separate viewer, so swiping through photos never lands on a document.
        <Lightbox
          open={energyDeclarationOpen}
          index={0}
          slides={[
            {
              src: energyDeclarationUrl,
              alt: 'Energideklaration, inskannat dokument',
              description: 'Energideklaration. Gemensam för flera lägenheter.',
            },
          ]}
          onClose={() => setEnergyDeclarationOpen(false)}
          maxZoomPixelRatio={ENERGY_DECLARATION_MAX_ZOOM_PIXEL_RATIO}
          toolbarButtons={[
            <a
              key="open-in-new-tab"
              href={energyDeclarationUrl}
              target="_blank"
              rel="noreferrer"
              className="yarl__button"
              aria-label="Öppna i ny flik"
              title="Öppna i ny flik"
            >
              <ExternalLink className="yarl__icon" />
            </a>,
          ]}
        />
      )}
    </Card>
  )
}
