import { Link } from 'react-router-dom'

import { generateBreadcrumbs } from '@/shared/lib/breadcrumbUtils'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/Breadcrumb'

interface PropertyBreadcrumbProps {
  property?: { id: string; name: string }
  building?: { id: string; name: string }
  residence?: { id: string; name: string }
  organizationNumber?: string
}

export const PropertyBreadcrumb = ({
  property,
  building,
  residence,
  organizationNumber,
}: PropertyBreadcrumbProps) => {
  const breadcrumbs = generateBreadcrumbs(
    property,
    building,
    residence,
    organizationNumber
  )

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {breadcrumbs.map((breadcrumb, index) => {
          const isLast = index === breadcrumbs.length - 1
          return (
            <div key={breadcrumb.path} className="flex items-center">
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={breadcrumb.path} state={{ organizationNumber }}>
                      {breadcrumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>

              {!isLast && <BreadcrumbSeparator />}
            </div>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
