import { Link } from 'react-router-dom'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/Breadcrumb'
import { generateBreadcrumbs } from '@/utils/breadcrumbUtils'

interface PropertyBreadcrumbProps {
  property?: { id: string; name: string }
  building?: { id: string; name: string }
  residence?: { id: string; name: string }
  companyId?: string
}

export const PropertyBreadcrumb = ({
  property,
  building,
  residence,
  companyId,
}: PropertyBreadcrumbProps) => {
  const breadcrumbs = generateBreadcrumbs(
    property,
    building,
    residence,
    companyId
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
                    <Link to={breadcrumb.path} state={{ companyId }}>
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
