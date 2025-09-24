import { Link } from 'react-router-dom'
import { Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SearchResult, SearchResultType } from '@/types/search'
import { cn } from '@/lib/utils'

interface GroupedResult {
  type: SearchResultType
  results: SearchResult[]
  count: number
  label: string
  icon: string
}

interface SearchResultsListProps {
  query: string
  groupedResults: GroupedResult[]
  isLoading: boolean
  onResultClick: () => void
}

const getResultStatusBadge = (result: SearchResult) => {
  switch (result.type) {
    case 'customer':
      return result.metadata?.hasActiveCases ? (
        <Badge variant="secondary" className="text-xs">
          Aktiva ärenden
        </Badge>
      ) : null
    case 'residence':
      return (
        <Badge
          variant={
            result.metadata?.status === 'vacant' ? 'destructive' : 'default'
          }
          className="text-xs"
        >
          {result.metadata?.status === 'vacant' ? 'Vakant' : 'Uthyrd'}
        </Badge>
      )
    case 'case':
      return (
        <Badge
          variant={
            result.metadata?.status === 'ongoing' ? 'secondary' : 'outline'
          }
          className="text-xs"
        >
          {result.metadata?.status === 'ongoing' ? 'Pågående' : 'Planerad'}
        </Badge>
      )
    case 'invoice':
      return (
        <Badge
          variant={
            result.metadata?.status === 'unpaid' ? 'destructive' : 'default'
          }
          className="text-xs"
        >
          {result.metadata?.status === 'unpaid' ? 'Obetald' : 'Betald'}
        </Badge>
      )
    case 'key':
      return (
        <Badge
          variant={
            result.metadata?.status === 'available' ? 'secondary' : 'default'
          }
          className="text-xs"
        >
          {result.metadata?.status === 'available' ? 'Tillgänglig' : 'Utlämnad'}
        </Badge>
      )
    default:
      return null
  }
}

const getQuickActions = (result: SearchResult) => {
  switch (result.type) {
    case 'customer':
      return [
        { label: 'Skicka notis', action: () => {} },
        { label: 'Visa kontrakt', action: () => {} },
      ]
    case 'residence':
      return [
        { label: 'Schemalägg besök', action: () => {} },
        { label: 'Kontakta hyresgäst', action: () => {} },
      ]
    case 'case':
      return [
        { label: 'Markera som klart', action: () => {} },
        { label: 'Tilldela', action: () => {} },
      ]
    case 'invoice':
      return [
        { label: 'Skicka påminnelse', action: () => {} },
        { label: 'Markera betald', action: () => {} },
      ]
    case 'key':
      return [
        { label: 'Visa historik', action: () => {} },
        { label: 'Boka utlämning', action: () => {} },
      ]
    default:
      return []
  }
}

export function SearchResultsList({
  query,
  groupedResults,
  isLoading,
  onResultClick,
}: SearchResultsListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Söker...</span>
      </div>
    )
  }

  if (query && groupedResults.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Inga resultat för "<strong>{query}</strong>"
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Prova att ändra söktermer eller filter
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {groupedResults.map(({ type, results, label, icon }) => (
        <div key={type} className="p-3">
          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
            <span>{icon}</span>
            <span className="font-medium">{label.toUpperCase()}</span>
            <Badge variant="outline" className="h-4 text-xs">
              {results.length}
            </Badge>
          </div>

          <div className="space-y-2">
            {results.slice(0, 5).map((result) => {
              const statusBadge = getResultStatusBadge(result)
              const quickActions = getQuickActions(result)

              return (
                <div
                  key={result.id}
                  className="group rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <Link
                    to={result.path}
                    onClick={onResultClick}
                    className="block"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate group-hover:text-primary">
                          {result.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.subtitle}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {statusBadge}
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    {result.description && (
                      <p className="text-xs text-muted-foreground">
                        {result.description}
                      </p>
                    )}
                  </Link>

                  {/* Quick actions */}
                  {quickActions.length > 0 && (
                    <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {quickActions.slice(0, 2).map((action, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            action.action()
                          }}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {results.length > 5 && (
              <div className="text-center pt-2">
                <Button variant="ghost" size="sm" className="text-xs">
                  Visa {results.length - 5} till {label.toLowerCase()}
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
