import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Box, Tag } from 'lucide-react'

import {
  libraryHref,
  treeNodeState,
  type ViewState,
} from '@/features/component-library'

import { useComponentEntity } from '@/entities/component'

import type { ComponentCategory, ComponentType } from '@/services/types'

import { useScrollToSelected } from '@/shared/hooks/useScrollToSelected'
import { sortBySwedishName } from '@/shared/lib/sortByName'
import { NavigationSkeleton } from '@/shared/ui/layout'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/Sidebar'

interface ComponentTypeNavigationProps {
  category: ComponentCategory
  type: ComponentType
  view: ViewState | undefined
}

export function ComponentTypeNavigation({
  category,
  type,
  view,
}: ComponentTypeNavigationProps) {
  const state = treeNodeState(view, { level: 'type', typeId: type.id })
  const { search } = useLocation()
  const scrollRef = useScrollToSelected<HTMLButtonElement>({
    isSelected: state === 'active',
    itemType: 'component',
  })
  const [isExpanded, setIsExpanded] = React.useState(state !== 'none')

  React.useEffect(() => {
    if (state !== 'none') setIsExpanded(true)
  }, [state, search])

  const subtypes = useComponentEntity('subtype', type.id, undefined, {
    enabled: isExpanded,
  })

  const typeState = {
    categoryId: category.id,
    categoryName: category.categoryName,
    typeId: type.id,
    typeName: type.typeName,
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        ref={scrollRef}
        asChild
        tooltip={type.typeName}
        isActive={state === 'active'}
        isSelectedInHierarchy={state === 'in-path'}
      >
        <Link
          to={libraryHref({ level: 'subtypes', ...typeState })}
          title={type.typeName}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Box />
          <span>{type.typeName}</span>
        </Link>
      </SidebarMenuButton>
      {isExpanded && (
        <div className="pl-4 mt-1">
          {subtypes.isLoading ? (
            <NavigationSkeleton />
          ) : subtypes.error ? (
            <div className="text-sm text-destructive px-2">
              Kunde inte ladda undertyperna
            </div>
          ) : (
            <SidebarMenu>
              {sortBySwedishName(
                subtypes.data ?? [],
                (subtype) => subtype.subTypeName
              ).map((subtype) => (
                <SubtypeNavigation
                  key={subtype.id}
                  href={libraryHref({
                    level: 'subtype',
                    ...typeState,
                    subtypeId: subtype.id,
                    subtypeName: subtype.subTypeName,
                    tab: 'components',
                  })}
                  name={subtype.subTypeName}
                  isActive={
                    treeNodeState(view, {
                      level: 'subtype',
                      subtypeId: subtype.id,
                    }) === 'active'
                  }
                />
              ))}
            </SidebarMenu>
          )}
        </div>
      )}
    </SidebarMenuItem>
  )
}

interface SubtypeNavigationProps {
  href: string
  name: string
  isActive: boolean
}

function SubtypeNavigation({ href, name, isActive }: SubtypeNavigationProps) {
  const scrollRef = useScrollToSelected<HTMLLIElement>({
    isSelected: isActive,
    itemType: 'component',
  })

  return (
    <SidebarMenuItem ref={scrollRef}>
      <SidebarMenuButton asChild tooltip={name} isActive={isActive}>
        <Link to={href} title={name}>
          <Tag />
          <span>{name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
