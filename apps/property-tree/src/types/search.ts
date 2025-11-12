export type SearchResultType =
  | 'customer'
  | 'residence'
  | 'case'
  | 'invoice'
  | 'key'
  | 'document'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  description?: string
  path: string
  metadata?: Record<string, any>
  score?: number
  highlightedText?: string
}

export interface SearchFilter {
  type: SearchResultType
  label: string
  icon: string
  count?: number
  active: boolean
}

export interface SavedSearch {
  id: string
  name: string
  query: string
  filters: SearchResultType[]
  createdAt: Date
  lastUsed: Date
  useCount: number
}

export interface SearchState {
  query: string
  results: SearchResult[]
  filters: SearchFilter[]
  isLoading: boolean
  isOpen: boolean
  favorites: SavedSearch[]
  history: string[]
}
