import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookX, ExternalLink } from 'lucide-react'

import {
  GuidesOverview,
  GuideView,
  UnpublishedGuideNotice,
} from '@/features/guides'

import { type GuideCategoryGroup, useGuide } from '@/entities/guide'
import { GUIDES_ADMIN_ROLE, useHasRole, useUser } from '@/entities/user'

import { isUnpublishedGuide } from '@/services/api/core'

import { useGuideSheet } from '@/shared/hooks/useGuideSheet'
import { paths, routes } from '@/shared/routes'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/Sheet'
import { Skeleton } from '@/shared/ui/Skeleton'

/**
 * Slide-in panel that shows the guide overview or a single guide next to
 * whatever page the user is working on. Mounted once per layout.
 */
export function GuideSheet() {
  const { isOpen, slug, openGuide, openOverview, close } = useGuideSheet()
  const canEdit = useHasRole(GUIDES_ADMIN_ROLE)
  const userState = useUser()
  // Which category the overview is showing. Kept here rather than in the
  // sheet context so going back from a guide returns to its category.
  const [category, setCategory] = useState<Pick<
    GuideCategoryGroup,
    'id' | 'name'
  > | null>(null)

  // However the sheet was closed, it reopens on all categories.
  useEffect(() => {
    if (!isOpen) setCategory(null)
  }, [isOpen])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl"
      >
        {slug ? (
          <GuideSheetGuide
            slug={slug}
            canEdit={canEdit}
            onBack={openOverview}
            onClose={close}
          />
        ) : (
          <>
            {category ? (
              <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b p-3 text-left">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCategory(null)}
                  aria-label="Tillbaka till alla kategorier"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <SheetTitle className="flex-1 truncate text-base">
                  {category.name}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Guider i kategorin {category.name}
                </SheetDescription>
              </SheetHeader>
            ) : (
              <SheetHeader className="border-b p-4 text-left">
                <SheetTitle>Guider</SheetTitle>
                <SheetDescription>
                  Steg-för-steg-instruktioner, utan att lämna sidan.
                </SheetDescription>
              </SheetHeader>
            )}
            <div className="p-4">
              {/* Wait for the role to be known, otherwise the list is fetched
                  once without drafts and again with them. */}
              {userState.tag === 'loading' ? (
                <Skeleton className="h-64" />
              ) : (
                <GuidesOverview
                  // Remount so the search starts empty in each category.
                  key={category?.id ?? 'all'}
                  includeDrafts={canEdit}
                  variant="sheet"
                  categoryId={category?.id}
                  onSelectGuide={(guide) => openGuide(guide.slug)}
                  onSelectCategory={({ id, name }) => setCategory({ id, name })}
                />
              )}
              <Button asChild variant="link" className="mt-4 px-0">
                <Link
                  to={
                    category ? paths.guideCategory(category.id) : routes.guides
                  }
                  onClick={close}
                >
                  {category
                    ? 'Öppna kategorin som sida'
                    : 'Öppna alla guider som sida'}
                  <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

interface GuideSheetGuideProps {
  slug: string
  canEdit: boolean
  onBack: () => void
  onClose: () => void
}

function GuideSheetGuide({
  slug,
  canEdit,
  onBack,
  onClose,
}: GuideSheetGuideProps) {
  const { data, isLoading, isError } = useGuide(slug)

  return (
    <>
      <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b p-3 text-left">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Tillbaka till alla guider"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <SheetTitle className="flex-1 truncate text-base">
          {data?.title ?? 'Guide'}
        </SheetTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to={paths.guide(slug)} onClick={onClose}>
            Öppna som sida
            <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </SheetHeader>
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : isError || !data ? (
          <EmptyState icon={BookX} title="Guiden hittades inte" />
        ) : isUnpublishedGuide(data) ? (
          <UnpublishedGuideNotice title={data.title} onNavigate={onClose} />
        ) : (
          <GuideView guide={data} variant="sheet" canEdit={canEdit} />
        )}
      </div>
    </>
  )
}
