import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BookX } from 'lucide-react'

import { GuideView, UnpublishedGuideNotice } from '@/features/guides'

import { guideQueryKeys, useGuide } from '@/entities/guide'
import { GUIDES_ADMIN_ROLE, useHasRole } from '@/entities/user'

import { isUnpublishedGuide } from '@/services/api/core'

import { paths, routes } from '@/shared/routes'
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
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const canEdit = useHasRole(GUIDES_ADMIN_ROLE)
  const { data, isLoading, isError } = useGuide(slug)

  // An old slug still resolves; swap the URL for the current one so copied
  // links stay canonical.
  useEffect(() => {
    if (!data || isUnpublishedGuide(data) || !data.redirectedFrom) return
    // Seed the cache under the canonical slug so the redirect does not
    // trigger a second fetch, and drop the marker so it cannot loop.
    queryClient.setQueryData(guideQueryKeys.bySlug(data.slug), {
      ...data,
      redirectedFrom: undefined,
    })
    navigate(`${paths.guide(data.slug)}${location.hash}`, { replace: true })
  }, [data, location.hash, navigate, queryClient])

  // Route handles cover static titles; a guide's title is only known here.
  useEffect(() => {
    if (!data) return
    document.title = `${data.title} | ONECore`
  }, [data])

  const title = data?.title ?? 'Guide'

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
