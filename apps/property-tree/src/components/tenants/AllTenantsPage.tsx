import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/Collapsible'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/v3/Badge'
import { Input } from '@/components/ui/Input'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import { ChevronDown } from 'lucide-react'
import { useTenantSearch } from '@/hooks/useTenantSearch'

const AllTenantsPage = () => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const { searchQuery, setSearchQuery, searchResults, showSearchResults, isSearching } =
    useTenantSearch()

  return (
    <div className="py-4 animate-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Kunder</h1>
        <p className="text-muted-foreground">
          Sök och hitta hyresgäster och sökande
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sök i kundbasen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Input
                  placeholder="Sök på personnummer eller kontaktkod..."
                  className="pl-4"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <Collapsible
              open={isFiltersOpen}
              onOpenChange={setIsFiltersOpen}
              className="border rounded-lg bg-muted/30 opacity-60"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex-1 justify-between px-0 hover:bg-transparent"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Filter</span>
                      <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                        0
                      </Badge>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isFiltersOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="px-4 pb-4">
                <div className="text-sm text-muted-foreground italic">
                  Kommer snart
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {showSearchResults ? (
            isSearching ? (
              <div className="text-center py-8 text-muted-foreground">
                Söker...
              </div>
            ) : searchResults.length > 0 ? (
              <ResponsiveTable
                data={searchResults}
                columns={[
                  {
                    key: 'name',
                    label: 'Namn',
                    render: (contact) => (
                      <span className="font-medium">{contact.fullName}</span>
                    ),
                  },
                  {
                    key: 'contactCode',
                    label: 'Kontaktkod',
                    render: (contact) => contact.contactCode,
                    hideOnMobile: true,
                  },
                  {
                    key: 'action',
                    label: 'Åtgärd',
                    render: (contact) => (
                      <Button asChild variant="link" size="sm">
                        <Link to={`/tenants/${contact.contactCode}`}>
                          Visa detaljer
                        </Link>
                      </Button>
                    ),
                    className: 'text-right',
                  },
                ]}
                keyExtractor={(contact) => contact.contactCode}
                emptyMessage="Inga kunder hittades"
                mobileCardRenderer={(contact) => (
                  <div className="space-y-2 w-full">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{contact.fullName}</div>
                        <div className="text-sm text-muted-foreground">
                          {contact.contactCode}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button asChild variant="link" size="sm">
                        <Link to={`/tenants/${contact.contactCode}`}>
                          Visa detaljer
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Inga resultat hittades
              </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Ange minst 3 tecken för att söka
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AllTenantsPage
