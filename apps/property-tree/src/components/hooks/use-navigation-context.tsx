import React from 'react'
import { CompanyWithLinks, PropertyWithLinks, BuildingWithLinks, StaircaseWithLinks, ResidenceWithLinks } from '@/services/types'

type NavigationItem = CompanyWithLinks | PropertyWithLinks | BuildingWithLinks | StaircaseWithLinks | ResidenceWithLinks

interface NavigationContextType {
  selectedId: string | null
  selectItem: (item: NavigationItem) => void
}

const NavigationContext = React.createContext<NavigationContextType | null>(null)

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const selectItem = React.useCallback((item: NavigationItem) => {
    setSelectedId(item.id)
  }, [])

  return (
    <NavigationContext.Provider value={{ selectedId, selectItem }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = React.useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}
