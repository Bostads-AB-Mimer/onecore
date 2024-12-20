import React from 'react'

interface CommandPaletteContext {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const CommandPaletteContext = React.createContext<CommandPaletteContext>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
})

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const value = React.useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((open) => !open),
    }),
    [isOpen],
  )

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  )
}

export const useCommandPalette = () => {
  const context = React.useContext(CommandPaletteContext)
  if (!context) {
    throw new Error(
      'useCommandPalette must be used within a CommandPaletteProvider',
    )
  }
  return context
}
