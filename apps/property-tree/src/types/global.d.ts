declare module '*.svg' {
  const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>
  export default content
}

interface NavigationItem {
  id: string
  name: string
  type: 'company' | 'property' | 'building' | 'staircase' | 'residence'
  children?: NavigationItem[]
  metadata?: {
    residenceId?: string
    propertyId?: string
    buildingId?: string
    staircaseId?: string
  }
}

interface Apartment {
  id: string
  address: string
  size: number
  bedrooms: number
  rent: number
  tenant: {
    name: string
    email: string
    phone: string
    moveInDate: string
  }
}

interface Tenant {
  id: string
  name: string
  email: string
  phone: string
  moveInDate: string
  residenceId: string
}
