/**
 * Global search bar component for searching across the application.
 * Includes input field, filter and favorite buttons, and a dropdown
 * for displaying search results, suggestions, filters, and favorites.
 *
 * TODO:
 * Integrate with actual search logic and data, currently it only triggers the old
 * Command Palette search modal on click.
 *
 */

import { useState, useRef } from 'react'
import { Search, X, Filter, Star } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { useCommandPalette } from '../hooks/useCommandPalette'

interface GlobalSearchBarProps {
  className?: string
  placeholder?: string
}

export function GlobalSearchBar({
  className,
  placeholder = 'Sök efter fastigheter, byggnader eller lägenheter...',
}: GlobalSearchBarProps) {
  // Open current search function in command palette for now
  const { open } = useCommandPalette()

  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)

  const handleInputFocus = () => {
    console.log('input focused')
  }

  const handleClearSearch = () => {
    console.log('clear search')
    inputRef.current?.focus()
  }

  const query = ''
  const setQuery = (q: string) => console.log('setQuery:', q)
  const hasActiveFilters = false
  const filters: { active: boolean }[] = []

  return (
    <div ref={searchRef} className={cn('relative w-full', className)}>
      {/* Main search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground pointer-events-none -translate-y-1/2" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          className="w-full pl-9 pr-24 h-10 bg-background border-input focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClick={() => open()}
          onFocus={handleInputFocus}
        />

        {/* Right side controls */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Active filters indicator */}
          {hasActiveFilters && (
            <Badge variant="secondary" className="h-6 text-xs">
              {filters.filter((f) => f.active).length}
            </Badge>
          )}

          {/* Filter button */}
          {/*
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              setShowFilters(!showFilters)
              setShowFavorites(false)
            }}
          >
            <Filter className="h-3 w-3" />
          </Button>
          */}
          {/* Favorites button */}
          {/*}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              console.log('show favorites')
            }}
          >
            <Star className="h-3 w-3" />
          </Button>
          */}
          {/* Clear button */}
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleClearSearch}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
