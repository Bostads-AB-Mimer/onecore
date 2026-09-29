import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookX } from 'lucide-react'

import { GuideView, UnpublishedGuideNotice } from '@/features/guides'

import { useGuide } from '@/entities/guide'
import { GUIDES_ADMIN_ROLE, useHasRole } from '@/entities/user'

import { isUnpublishedGuide } from '@/services/api/core'

import { routes } from '@/shared/routes'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/Breadcrumb'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ViewLayout } from '@/shared/ui/layout'
import { Skeleton } from '@/shared/ui/Skeleton'

export function GuidePage() {
  const { slug } = useParams<{ slug: string }>()
  const canEdit = useHasRole(GUIDES_ADMIN_ROLE)
  const { data, isLoading, isError } = useGuide(slug)

  const title = data?.title ?? 'Guide'
  // Follows what the page renders: loading, not found, or the guide.
  const documentTitle = isLoading
    ? 'Guide'
    : isError || !data
      ? 'Guiden hittades inte'
      : data.title

  // Route handles cover static titles; a guide's title is only known here,
  // so the route opts out of RouteDocumentTitle.
  useEffect(() => {
    document.title = `${documentTitle} | ONECore`
  }, [documentTitle])

  return (
    <ViewLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={routes.guides}>Guider</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {data && !isUnpublishedGuide(data) && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>{data.category.name}</BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {isLoading ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : isError || !data ? (
        <EmptyState
          icon={BookX}
          title="Guiden hittades inte"
          description="Länken kan vara felaktig eller så har guiden tagits bort."
          action={
            <Button asChild variant="outline">
              <Link to={routes.guides}>Till alla guider</Link>
            </Button>
          }
        />
      ) : isUnpublishedGuide(data) ? (
        <UnpublishedGuideNotice title={data.title} />
      ) : (
        <GuideView guide={data} canEdit={canEdit} />
      )}
    </ViewLayout>
  )
}
