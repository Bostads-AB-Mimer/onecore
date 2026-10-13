import React from 'react'
import { Link } from 'react-router-dom'
import { Folder } from 'lucide-react'

import {
  libraryHref,
  treeNodeState,
  type ViewState,
} from '@/features/component-library'

import { useComponentEntity } from '@/entities/component'

import type { ComponentCategory } from '@/services/types'

import { sortBySwedishName } from '@/shared/lib/sortByName'
import { NavigationSkeleton } from '@/shared/ui/layout'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/Sidebar'

import { ComponentTypeNavigation } from './ComponentTypeNavigation'

interface ComponentCategoryNavigationProps {
  category: ComponentCategory
  view: ViewState | undefined
}

export function ComponentCategoryNavigation({
  category,
  view,
}: ComponentCategoryNavigationProps) {
  const state = treeNodeState(view, {
    level: 'category',
    categoryId: category.id,
  })
  const [isExpanded, setIsExpanded] = React.useState(state !== 'none')

  React.useEffect(() => {
    if (state !== 'none') setIsExpanded(true)
  }, [state])

  const types = useComponentEntity('type', category.id, undefined, {
    enabled: isExpanded,
  })

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={category.categoryName}
        isActive={state === 'active'}
        isSelectedInHierarchy={state === 'in-path'}
      >
        <Link
          to={libraryHref({
            level: 'types',
            categoryId: category.id,
            categoryName: category.categoryName,
          })}
          title={category.categoryName}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Folder />
          <span>{category.categoryName}</span>
        </Link>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          {types.isLoading ? (
            <NavigationSkeleton />
          ) : types.error ? (
            <div className="text-sm text-destructive px-2">
              Kunde inte ladda typerna
            </div>
          ) : (
            <SidebarMenu>
              {sortBySwedishName(types.data ?? [], (type) => type.typeName).map(
                (type) => (
                  <ComponentTypeNavigation
                    key={type.id}
                    category={category}
                    type={type}
                    view={view}
                  />
                )
              )}
            </SidebarMenu>
          )}
        </div>
      )}
    </SidebarMenuItem>
  )
}
