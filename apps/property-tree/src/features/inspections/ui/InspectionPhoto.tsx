import { useQuery } from '@tanstack/react-query'

import { fileStorageService } from '@/services/api/core'

import { cn } from '@/shared/lib/utils'

interface InspectionPhotoProps {
  path: string
  alt: string
  className?: string
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void
}

export function InspectionPhoto({
  path,
  alt,
  className,
  onClick,
}: InspectionPhotoProps) {
  const urlQuery = useQuery({
    queryKey: ['inspection-photo-url', path],
    queryFn: () => fileStorageService.getFileUrl(path),
    // Signed URLs expire in 1h by default; refresh well before that.
    staleTime: 30 * 60 * 1000,
  })

  if (urlQuery.isLoading) {
    return (
      <div
        className={cn('bg-muted animate-pulse', className)}
        aria-label={`${alt} (laddar)`}
      />
    )
  }

  if (urlQuery.isError || !urlQuery.data) {
    return (
      <div
        className={cn(
          'bg-muted flex items-center justify-center text-xs text-muted-foreground',
          className
        )}
        aria-label={`${alt} (kunde inte laddas)`}
      >
        Kunde inte ladda foto
      </div>
    )
  }

  return (
    <img
      src={urlQuery.data}
      alt={alt}
      className={className}
      onClick={onClick}
    />
  )
}
