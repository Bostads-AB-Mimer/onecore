import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import type { ViewState } from '../hooks/useComponentLibraryHandlers'

interface ComponentLibraryBreadcrumbProps {
  viewState: ViewState
  onNavigate: (newState: ViewState) => void
}

interface BreadcrumbItem {
  label: string
  onClick?: () => void
}

function getBreadcrumbItems(
  viewState: ViewState,
  navigateTo: (newState: ViewState) => void
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = []

  // Always start with Categories
  items.push({
    label: 'Kategorier',
    onClick:
      viewState.level !== 'categories'
        ? () => navigateTo({ level: 'categories' })
        : undefined,
  })

  if (viewState.level === 'categories') return items

  // Add category
  items.push({
    label: viewState.categoryName,
    onClick:
      viewState.level !== 'types'
        ? () =>
            navigateTo({
              level: 'types',
              categoryId: viewState.categoryId,
              categoryName: viewState.categoryName,
            })
        : undefined,
  })

  if (viewState.level === 'types') return items

  // Add type
  items.push({
    label: viewState.typeName,
    onClick:
      viewState.level !== 'subtypes'
        ? () =>
            navigateTo({
              level: 'subtypes',
              typeId: viewState.typeId,
              typeName: viewState.typeName,
              categoryId: viewState.categoryId,
              categoryName: viewState.categoryName,
            })
        : undefined,
  })

  if (viewState.level === 'subtypes') return items

  // Add subtype
  items.push({
    label: viewState.subtypeName,
    onClick:
      viewState.level !== 'models'
        ? () =>
            navigateTo({
              level: 'models',
              subtypeId: viewState.subtypeId,
              subtypeName: viewState.subtypeName,
              typeId: viewState.typeId,
              typeName: viewState.typeName,
              categoryId: viewState.categoryId,
              categoryName: viewState.categoryName,
            })
        : undefined,
  })

  if (viewState.level === 'models') return items

  // Add model (only for instances level)
  items.push({
    label: viewState.modelName,
  })

  return items
}

export const ComponentLibraryBreadcrumb = ({
  viewState,
  onNavigate,
}: ComponentLibraryBreadcrumbProps) => {
  const items = getBreadcrumbItems(viewState, onNavigate)

  return (
    <div className="flex items-center gap-2">
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="font-medium">{item.label}</span>
          )}
        </Fragment>
      ))}
    </div>
  )
}
