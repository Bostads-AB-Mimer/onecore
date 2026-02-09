import { Skeleton } from '@/components/ui/Skeleton'

export function NavigationSkeleton() {
  return (
    <>
      <Skeleton className="h-8 mx-2 mb-2" />
      <Skeleton className="h-8 mx-2" />
    </>
  )
}
