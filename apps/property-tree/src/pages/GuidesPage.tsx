import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

import { GuidesOverview } from '@/features/guides'

import { GUIDES_ADMIN_ROLE, useHasRole } from '@/entities/user'

import { routes } from '@/shared/routes'
import { Button } from '@/shared/ui/Button'
import { ViewLayout } from '@/shared/ui/layout'

export function GuidesPage() {
  const canEdit = useHasRole(GUIDES_ADMIN_ROLE)

  return (
    <ViewLayout>
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">Guider</h1>
        <p className="text-muted-foreground">
          Steg-för-steg-instruktioner för system och arbetsflöden
        </p>
      </div>

      <GuidesOverview
        includeDrafts={canEdit}
        actions={
          canEdit ? (
            <Button asChild>
              <Link to={routes.guideNew}>
                <Plus className="mr-2 h-4 w-4" />
                Ny guide
              </Link>
            </Button>
          ) : undefined
        }
      />
    </ViewLayout>
  )
}
