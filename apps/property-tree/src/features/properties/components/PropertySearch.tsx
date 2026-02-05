import { Input } from '@/components/ui/Input'

interface PropertySearchProps {
  searchQuery: string
  setSearchQuery: (value: string) => void
}

export const PropertySearch = ({
  searchQuery,
  setSearchQuery,
}: PropertySearchProps) => {
  return (
    <div className="relative flex-1">
      <Input
        placeholder="Sök på beteckning, kod, byggnad, lägenhet..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  )
}
