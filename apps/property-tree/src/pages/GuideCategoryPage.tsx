import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FolderX } from 'lucide-react'

import { GuidesOverview } from '@/features/guides'

import { useGuideCategories } from '@/entities/guide'
import { GUIDES_ADMIN_ROLE, useHasRole, useUser } from '@/entities/user'

import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
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

export function GuideCategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const canEdit = useHasRole(GUIDES_ADMIN_ROLE)
  const userState = useUser()
  const { data: categories, isLoading, isError } = useGuideCategories()

  const category = categories?.find(({ id }) => id === categoryId)
  const parent =
    category?.parentId != null
      ? categories?.find(({ id }) => id === category.parentId)
      : undefined
  // Follows what the page renders: loading, a fetch error, not found, or the
  // category. Null while loading.
  const title = isLoading
    ? null
    : isError
      ? 'Kategorin kunde inte hämtas'
      : category
        ? category.name
        : 'Kategorin hittades inte'

  // The category name is only known here, so the route opts out of
  // RouteDocumentTitle.
  useDocumentTitle(title ?? 'Guider')

  const content = () => {
    if (isLoading || userState.tag === 'loading') {
      return <Skeleton className="h-64" />
    }
    if (isError) {
      return (
        <p className="py-8 text-center text-destructive">
          Kategorin kunde inte hämtas. Försök igen om en stund.
        </p>
      )
    }
    if (!category) {
      return (
        <EmptyState
          icon={FolderX}
          title="Kategorin hittades inte"
          description="Länken kan vara felaktig eller så har kategorin tagits bort."
          action={
            <Button asChild variant="outline">
              <Link to={routes.guides}>Till alla guider</Link>
            </Button>
          }
        />
      )
    }
    return (
      <GuidesOverview
        // Remount so the search starts empty when moving from a category to
        // one of its subcategories on the same route.
        key={category.id}
        includeDrafts={canEdit}
        categoryId={category.id}
      />
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
          <BreadcrumbSeparator />
          {parent && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={paths.guideCategory(parent.id)}>{parent.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{title ?? 'Kategori'}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6">
        <Button asChild variant="link" className="mb-2 px-0">
          <Link to={parent ? paths.guideCategory(parent.id) : routes.guides}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {parent ? `Tillbaka till ${parent.name}` : 'Alla kategorier'}
          </Link>
        </Button>
        {/* Only a found category gets a heading; the error and not-found
            states below explain themselves. */}
        {isLoading ? (
          <Skeleton className="h-9 w-1/3" />
        ) : (
          category && <h1 className="text-3xl font-bold">{category.name}</h1>
        )}
      </div>

      {content()}
    </ViewLayout>
  )
}
