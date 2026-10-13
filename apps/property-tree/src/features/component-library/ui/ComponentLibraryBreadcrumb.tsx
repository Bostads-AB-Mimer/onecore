import { Fragment } from 'react'
import { Link } from 'react-router-dom'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/Breadcrumb'

import { libraryHref } from '../lib/libraryTree'
import {
  ancestorViewStates,
  levelTitle,
  type ViewState,
} from '../lib/libraryUrlState'

interface ComponentLibraryBreadcrumbProps {
  viewState: ViewState
}

export const ComponentLibraryBreadcrumb = ({
  viewState,
}: ComponentLibraryBreadcrumbProps) => {
  if (viewState.level === 'categories') return null

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {ancestorViewStates(viewState).map((ancestor) => (
          <Fragment key={ancestor.level}>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={libraryHref(ancestor)}>{levelTitle(ancestor)}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}
        <BreadcrumbItem>
          <BreadcrumbPage>{levelTitle(viewState)}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
