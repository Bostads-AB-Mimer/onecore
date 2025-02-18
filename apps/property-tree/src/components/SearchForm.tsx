import { Search } from 'lucide-react'
import { useCommandPalette } from '@/components/hooks/useCommandPalette'
import { Label } from '@/components/ui/Label'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from '@/components/ui/Sidebar'

export function SearchForm({ ...props }: React.ComponentProps<'form'>) {
  const { open } = useCommandPalette()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      open()
    }
  }

  return (
    <form {...props}>
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative">
          <Label htmlFor="search" className="sr-only">
            Search
          </Label>
          <SidebarInput
            id="search"
            placeholder="Search (%K)"
            className="pl-8"
            onKeyDown={handleKeyDown}
            onClick={() => open()}
          />
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50" />
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  )
}
