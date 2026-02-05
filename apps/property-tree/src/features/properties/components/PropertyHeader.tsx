import type { PropertyDetail } from '@/types/api'

interface PropertyHeaderProps {
  propertyDetail: PropertyDetail
}

export const PropertyHeader = ({ propertyDetail }: PropertyHeaderProps) => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{propertyDetail.designation}</h1>
    </div>
  )
}
