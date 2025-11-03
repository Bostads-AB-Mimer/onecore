import { useState, useEffect } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Package,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getBundlesByContactWithLoanedKeys } from '@/services/api/keyBundleService'
import type { BundleWithLoanedKeysInfo } from '@/services/types'

type Props = {
  contactCode: string
  onBundleClick: (bundleId: string) => void
}

export function ContactBundlesWithLoanedKeysCard({
  contactCode,
  onBundleClick,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [bundles, setBundles] = useState<BundleWithLoanedKeysInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    if (!isOpen || hasLoaded) {
      return
    }

    const fetchBundles = async () => {
      setLoading(true)
      try {
        const data = await getBundlesByContactWithLoanedKeys(contactCode)
        setBundles(data)
        setHasLoaded(true)
      } catch (error) {
        console.error('Error fetching bundles with loaned keys:', error)
        setBundles([])
        setHasLoaded(true)
      } finally {
        setLoading(false)
      }
    }

    fetchBundles()
  }, [isOpen, hasLoaded, contactCode])

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <CardTitle className="text-base">
              Nyckelsamlingar med utlånade nycklar
              {hasLoaded && bundles.length > 0 && ` (${bundles.length})`}
            </CardTitle>
          </div>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bundles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Inga nyckelsamlingar har utlånade nycklar till denna kontakt
            </p>
          ) : (
            <div className="space-y-2">
              {bundles.map((bundle) => (
                <div
                  key={bundle.id}
                  onClick={() => onBundleClick(bundle.id)}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors group"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bundle.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {bundle.loanedKeyCount}/{bundle.totalKeyCount} nycklar
                        utlånade
                      </Badge>
                    </div>
                    {bundle.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {bundle.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
