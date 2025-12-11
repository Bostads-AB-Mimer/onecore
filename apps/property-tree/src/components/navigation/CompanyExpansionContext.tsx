import React from 'react'

interface CompanyExpansionContextType {
  expandedCompanyCodes: Set<string>
  requestExpansion: (companyCode: string) => void
  clearExpansions: () => void
}

const CompanyExpansionContext = React.createContext<
  CompanyExpansionContextType | undefined
>(undefined)

export function CompanyExpansionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [expandedCompanyCodes, setExpandedCompanyCodes] = React.useState<
    Set<string>
  >(new Set())

  const requestExpansion = React.useCallback((companyCode: string) => {
    setExpandedCompanyCodes((prev) => new Set(prev).add(companyCode))
  }, [])

  const clearExpansions = React.useCallback(() => {
    setExpandedCompanyCodes(new Set())
  }, [])

  return (
    <CompanyExpansionContext.Provider
      value={{ expandedCompanyCodes, requestExpansion, clearExpansions }}
    >
      {children}
    </CompanyExpansionContext.Provider>
  )
}

export function useCompanyExpansion() {
  const context = React.useContext(CompanyExpansionContext)
  if (!context) {
    throw new Error(
      'useCompanyExpansion must be used within CompanyExpansionProvider'
    )
  }
  return context
}
