import { ChevronLeft, ChevronRight } from 'lucide-react'

import { useSidebar } from '@/shared/ui/Sidebar'

//TODO better design for toggle button
export function SidebarToggleButton() {
  const { toggleSidebar, open } = useSidebar()

  return (
    <button
      onClick={toggleSidebar}
      className="fixed top-[4.25rem] z-20 hidden md:flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent transition-all duration-200"
      style={{
        left: open ? 'calc(var(--sidebar-width) - 0.75rem)' : '0.25rem',
      }}
      aria-label="Toggle Sidebar"
    >
      {open ? (
        <ChevronLeft className="h-3 w-3" />
      ) : (
        <ChevronRight className="h-3 w-3" />
      )}
    </button>
  )
}
