import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@radix-ui/react-collapsible'
import { ChevronRight, Settings } from 'lucide-react'

import {
  libraryViewFromLocation,
  treeNodeState,
} from '@/features/component-library'

import { useComponentEntity } from '@/entities/component'

import { sortBySwedishName } from '@/shared/lib/sortByName'
import { routes } from '@/shared/routes'
import { NavigationSkeleton } from '@/shared/ui/layout'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/Sidebar'

import { ComponentCategoryNavigation } from './ComponentCategoryNavigation'

export function ComponentLibraryNavigation() {
  const { pathname, search } = useLocation()
  const view = libraryViewFromLocation(pathname, search)
  const isOnLibrary = view !== undefined

  const [isOpen, setIsOpen] = React.useState(isOnLibrary)
  const [isCategoriesOpen, setIsCategoriesOpen] = React.useState(true)

  React.useEffect(() => {
    if (isOnLibrary) {
      setIsOpen(true)
      setIsCategoriesOpen(true)
    }
  }, [isOnLibrary])

  const categoriesState = treeNodeState(view, { level: 'categories' })
  const categories = useComponentEntity('category', undefined, undefined, {
    enabled: isOpen && isCategoriesOpen,
  })

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="group/library"
    >
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton asChild tooltip="Komponentbibliotek">
                <Link
                  to={routes.components}
                  onClick={() => setIsCategoriesOpen(true)}
                >
                  <Settings />
                  <span>Komponentbibliotek</span>
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/library:rotate-90" />
                </Link>
              </SidebarMenuButton>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <SidebarGroupContent>
                <Collapsible
                  open={isCategoriesOpen}
                  onOpenChange={setIsCategoriesOpen}
                  className="group/library-categories ml-4"
                >
                  <SidebarMenuButton
                    asChild
                    isActive={categoriesState === 'active'}
                    isSelectedInHierarchy={categoriesState === 'in-path'}
                  >
                    <Link
                      to={routes.components}
                      onClick={() => setIsCategoriesOpen(true)}
                    >
                      <ChevronRight className="transition-transform group-data-[state=open]/library-categories:rotate-90" />
                      <span>Kategorier</span>
                    </Link>
                  </SidebarMenuButton>

                  <CollapsibleContent>
                    <SidebarGroupContent>
                      {categories.isLoading ? (
                        <NavigationSkeleton />
                      ) : categories.error ? (
                        <div className="text-sm text-destructive px-2">
                          Kunde inte ladda kategorierna
                        </div>
                      ) : (
                        <SidebarMenu>
                          {sortBySwedishName(
                            categories.data ?? [],
                            (category) => category.categoryName
                          ).map((category) => (
                            <ComponentCategoryNavigation
                              key={category.id}
                              category={category}
                              view={view}
                            />
                          ))}
                        </SidebarMenu>
                      )}
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </Collapsible>
  )
}
