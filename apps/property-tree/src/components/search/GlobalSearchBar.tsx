import { useState, useRef, useEffect } from 'react'
import { Search, X, Filter, Star, Clock, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Separator } from '@/components/ui/Separator'
//import { useGlobalSearch } from '@/components/hooks/useGlobalSearch'
import { SearchResultsList } from '../search/SearchResultsList'
import { SearchFilters } from '../search/SearchFilters'
import { SearchFavorites } from '../search/SearchFavorites'
import { cn } from '@/lib/utils'

interface GlobalSearchBarProps {
  className?: string
  placeholder?: string
}

export function GlobalSearchBar({
  className,
  placeholder = 'Sök efter kunder, lägenheter, ärenden...',
}: GlobalSearchBarProps) {
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)

  /*
  const {
    query,
    results,
    suggestions,
    groupedResults,
    isLoading,
    isOpen,
    favorites,
    history,
    hasActiveFilters,
    filters,
    setQuery,
    toggleFilter,
    clearFilters,
    openSearch,
    closeSearch,
    clearSearch,
    saveCurrentSearch,
    useSavedSearch,
    deleteSavedSearch,
  } = useGlobalSearch()
   */

  // Handle clicks outside the search container
  /*
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        closeSearch()
        setShowFilters(false)
        setShowFavorites(false)
      }
    }
  
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [closeSearch])
 */
  // Keyboard navigation
  /*
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSearch()
        setShowFilters(false)
        setShowFavorites(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        openSearch()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeSearch, openSearch])
  */

  const handleInputFocus = () => {
    /*
    openSearch()
    setShowFavorites(false)
    setShowFilters(false)
    */
    console.log('input focused')
  }

  const handleClearSearch = () => {
    //clearSearch()
    console.log('clear search')
    inputRef.current?.focus()
  }

  const handleSuggestionClick = (suggestion: string) => {
    //setQuery(suggestion)
    //inputRef.current?.focus()
    console.log('suggestion clicked:', suggestion)
  }

  const hasActiveFilters = false
  const query = ''
  const setQuery = (q: string) => console.log('setQuery:', q)
  const closeSearch = () => console.log('closeSearch')
  const toggleFilter = (type: string) => console.log('toggleFilter:', type)
  const clearFilters = () => console.log('clearFilters')
  const saveCurrentSearch = () => console.log('saveCurrentSearch')
  const useSavedSearch = (fav: any) => console.log('useSavedSearch:', fav)
  const deleteSavedSearch = (fav: any) => console.log('deleteSavedSearch:', fav)
  // Mock data for demonstration
  // Replace these with actual data from useGlobalSearch
  // when integrating
  const results: any[] = []
  const groupedResults: any[] = []
  const suggestions: string[] = []
  const isLoading = false
  const favorites: any[] = []
  const history: string[] = []
  const filters: Array<{
    type: string
    label: string
    icon: string
    active: boolean
    count?: number
  }> = []
  const showDropdown = false

  /*
  const showDropdown =
    isOpen &&
    (query.length > 0 ||
      suggestions.length > 0 ||
      showFavorites ||
      showFilters ||
      (query.length === 0 && (favorites.length > 0 || history.length > 0)))
  */

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

          {/* Favorites button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              setShowFavorites(!showFavorites)
              setShowFilters(false)
            }}
          >
            <Star className="h-3 w-3" />
          </Button>

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

      {/* Search dropdown - Jira-inspired wide layout */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-xl max-h-[95vh] overflow-hidden z-50 min-w-[800px]">
          <div className="flex">
            {/* Main content area - Left side */}
            <div className="flex-1 min-w-0">
              {/* Filter section - compact horizontal layout */}
              <div className="p-4 border-b bg-accent/10">
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Filtrera efter typ
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {filters.map((filter) => (
                    <button
                      key={filter.type}
                      onClick={() => toggleFilter(filter.type)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors',
                        filter.active
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent border border-border'
                      )}
                    >
                      <span className="text-sm">{filter.icon}</span>
                      <span>{filter.label}</span>
                      {filter.count !== undefined && filter.count > 0 && (
                        <Badge
                          variant={filter.active ? 'secondary' : 'outline'}
                          className="h-4 text-xs ml-1 px-1"
                        >
                          {filter.count}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-6 text-xs px-2"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Rensa alla filter
                  </Button>
                )}
              </div>

              {/* Search results or suggestions */}
              {query.length > 0 ? (
                <div className="overflow-y-auto max-h-[87vh]">
                  {/* Matching favorites - highest priority */}
                  {favorites.filter(
                    (fav) =>
                      fav.name.toLowerCase().includes(query.toLowerCase()) ||
                      fav.query.toLowerCase().includes(query.toLowerCase())
                  ).length > 0 && (
                    <div className="p-4 border-b bg-accent/10">
                      <div className="text-xs font-semibold text-primary mb-3 uppercase tracking-wide flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        Matchande favoriter
                      </div>
                      <div className="space-y-1">
                        {favorites
                          .filter(
                            (fav) =>
                              fav.name
                                .toLowerCase()
                                .includes(query.toLowerCase()) ||
                              fav.query
                                .toLowerCase()
                                .includes(query.toLowerCase())
                          )
                          .slice(0, 3)
                          .map((favorite) => (
                            <button
                              key={favorite.id}
                              className="block w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors border border-primary/20"
                              onClick={() => useSavedSearch(favorite)}
                            >
                              <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-primary fill-current" />
                                <div>
                                  <div className="font-medium text-sm">
                                    {favorite.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {favorite.query} • {favorite.useCount}{' '}
                                    gånger • Sparad sökning
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Show suggestions when typing */}
                  {suggestions.length > 0 &&
                    results.length === 0 &&
                    !isLoading && (
                      <div className="p-4 border-b">
                        <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                          Sökförslag
                        </div>
                        <div className="space-y-1">
                          {suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              className="block w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
                              onClick={() => handleSuggestionClick(suggestion)}
                            >
                              <Search className="h-4 w-4 inline mr-2 text-muted-foreground" />
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Search results */}
                  <SearchResultsList
                    query={query}
                    groupedResults={groupedResults}
                    isLoading={isLoading}
                    onResultClick={closeSearch}
                  />
                </div>
              ) : (
                <div className="p-4 space-y-6 overflow-y-auto max-h-[82vh]">
                  {/* Saved searches/Favorites - prominent placement */}
                  {favorites.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                        Sparade sökningar
                      </div>
                      <div className="space-y-1">
                        {favorites.map((favorite) => (
                          <button
                            key={favorite.id}
                            className="block w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors"
                            onClick={() => useSavedSearch(favorite)}
                          >
                            <div className="flex items-center gap-2">
                              <Star className="h-4 w-4 text-primary" />
                              <div>
                                <div className="font-medium text-sm">
                                  {favorite.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {favorite.query} • {favorite.useCount} gånger
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent searches */}
                  {history.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                        Senaste sökningar
                      </div>
                      <div className="space-y-1">
                        {history.slice(0, 8).map((item, index) => (
                          <button
                            key={index}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
                            onClick={() => setQuery(item)}
                          >
                            <Clock className="h-4 w-4 inline mr-2 text-muted-foreground" />
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="w-96 border-l bg-accent/20">
              <div className="p-4 space-y-6 h-full overflow-y-auto">
                {/* Favorites management */}
                {query && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                      Spara sökning
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFavorites(true)}
                      className="w-full h-8 text-xs"
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Spara denna sökning
                    </Button>
                  </div>
                )}
              </div>

              {/* Quick navigation - bottom of sidebar */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Gå till alla
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs justify-start"
                  >
                    Kunder
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs justify-start"
                  >
                    Fastigheter
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs justify-start"
                  >
                    Ärenden
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs justify-start"
                  >
                    Dokument
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Favorites creation modal overlay */}
          {showFavorites && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm">
              <div className="p-6">
                <SearchFavorites
                  favorites={favorites}
                  onUseFavorite={useSavedSearch}
                  onDeleteFavorite={deleteSavedSearch}
                  onSaveCurrentSearch={saveCurrentSearch}
                  currentQuery={query}
                  hasActiveFilters={hasActiveFilters}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFavorites(false)}
                  className="mt-4"
                >
                  Stäng
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
