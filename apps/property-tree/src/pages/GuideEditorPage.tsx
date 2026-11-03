import { Link, useParams } from 'react-router-dom'
import { BookX, ShieldX } from 'lucide-react'

import { GuideEditor } from '@/features/guides'

import { useGuide } from '@/entities/guide'
import { GUIDES_ADMIN_ROLE, useHasRole, useUser } from '@/entities/user'

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

/** Handles both /guider/ny (no slug) and /guider/:slug/redigera. */
export function GuideEditorPage() {
  const { slug } = useParams<{ slug?: string }>()
  const canEdit = useHasRole(GUIDES_ADMIN_ROLE)
  const userState = useUser()
  const { data, isLoading } = useGuide(slug)

  const authorName = userState.tag === 'success' ? userState.user.name : 'Okänd'
  const isNew = slug === undefined

  const content = () => {
    if (userState.tag === 'loading') {
      return <Skeleton className="h-64" />
    }
    if (!canEdit) {
      return (
        <EmptyState
          icon={ShieldX}
          title="Du kan inte redigera guider"
          description="Det kräver rollen guides-admin. Kontakta en administratör om du behöver behörigheten."
          action={
            <Button asChild variant="outline">
              <Link to={routes.guides}>Till alla guider</Link>
            </Button>
          }
        />
      )
    }
    if (isNew) {
      return <GuideEditor authorName={authorName} />
    }
    if (isLoading) {
      return <Skeleton className="h-64" />
    }
    // A failed background refetch keeps the editor mounted on the data we
    // already have; only a guide we never loaded is "not found".
    if (!data || isUnpublishedGuide(data)) {
      return (
        <EmptyState
          icon={BookX}
          title="Guiden hittades inte"
          action={
            <Button asChild variant="outline">
              <Link to={routes.guides}>Till alla guider</Link>
            </Button>
          }
        />
      )
    }
    // Keyed by id so a different guide always starts from fresh state.
    return (
      <GuideEditor key={data.id} initialGuide={data} authorName={authorName} />
    )
  }

  return (
    <ViewLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={routes.guides}>Guider</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {!isNew && data && !isUnpublishedGuide(data) && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={paths.guide(data.slug)}>{data.title}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{isNew ? 'Ny guide' : 'Redigera'}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="mb-6 text-3xl font-bold">
        {isNew ? 'Ny guide' : 'Redigera guide'}
      </h1>

      {content()}
    </ViewLayout>
  )
}
