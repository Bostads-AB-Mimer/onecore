import * as React from 'react'

interface LeaseExportsSheetContextType {
  isOpen: boolean
  open: () => void
  close: () => void
}

const LeaseExportsSheetContext = React.createContext<
  LeaseExportsSheetContextType | undefined
>(undefined)

export function LeaseExportsSheetProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = React.useState(false)

  const open = React.useCallback(() => setIsOpen(true), [])
  const close = React.useCallback(() => setIsOpen(false), [])

  const value = React.useMemo(
    () => ({ isOpen, open, close }),
    [isOpen, open, close]
  )

  return (
    <LeaseExportsSheetContext.Provider value={value}>
      {children}
    </LeaseExportsSheetContext.Provider>
  )
}

export function useLeaseExportsSheet() {
  const context = React.useContext(LeaseExportsSheetContext)
  if (context === undefined) {
    throw new Error(
      'useLeaseExportsSheet must be used within a LeaseExportsSheetProvider'
    )
  }
  return context
}
