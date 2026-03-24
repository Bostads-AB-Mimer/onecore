import * as React from 'react'

interface FeedbackModalContextType {
  isOpen: boolean
  open: () => void
  close: () => void
}

const FeedbackModalContext = React.createContext<
  FeedbackModalContextType | undefined
>(undefined)

export function FeedbackModalProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = React.useState(false)

  const open = React.useCallback(() => setIsOpen(true), [])
  const close = React.useCallback(() => setIsOpen(false), [])

  const value = React.useMemo(() => ({ isOpen, open, close }), [isOpen])

  return (
    <FeedbackModalContext.Provider value={value}>
      {children}
    </FeedbackModalContext.Provider>
  )
}

export function useFeedbackModal() {
  const context = React.useContext(FeedbackModalContext)
  if (context === undefined) {
    throw new Error(
      'useFeedbackModal must be used within a FeedbackModalProvider'
    )
  }
  return context
}
