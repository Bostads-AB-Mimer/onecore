import * as React from 'react'

interface GuideSheetContextType {
  isOpen: boolean
  /** Slug of the guide shown in the sheet, or null for the overview. */
  slug: string | null
  /** Open the sheet on a specific guide, e.g. from a contextual "?" button. */
  openGuide: (slug: string) => void
  openOverview: () => void
  close: () => void
}

const GuideSheetContext = React.createContext<
  GuideSheetContextType | undefined
>(undefined)

/**
 * State for the slide-in guide panel. Lives in shared/ so any layer can
 * trigger it; the panel itself is rendered by widgets/guide-sheet.
 */
export function GuideSheetProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [slug, setSlug] = React.useState<string | null>(null)

  const openGuide = React.useCallback((nextSlug: string) => {
    setSlug(nextSlug)
    setIsOpen(true)
  }, [])
  const openOverview = React.useCallback(() => {
    setSlug(null)
    setIsOpen(true)
  }, [])
  const close = React.useCallback(() => setIsOpen(false), [])

  const value = React.useMemo(
    () => ({ isOpen, slug, openGuide, openOverview, close }),
    [isOpen, slug, openGuide, openOverview, close]
  )

  return (
    <GuideSheetContext.Provider value={value}>
      {children}
    </GuideSheetContext.Provider>
  )
}

export function useGuideSheet() {
  const context = React.useContext(GuideSheetContext)
  if (context === undefined) {
    throw new Error('useGuideSheet must be used within a GuideSheetProvider')
  }
  return context
}
