import { Badge } from '@/components/ui/badge'

interface KeyBundlesHeaderProps {
  totalKeyBundles: number
  displayedKeyBundles: number
}

export function KeyBundlesHeader({
  totalKeyBundles,
  displayedKeyBundles,
}: KeyBundlesHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Nyckelsamlingar
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {displayedKeyBundles} av {totalKeyBundles} nyckelsamlingar
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="text-xs">
          Mimer Nyckelhantering
        </Badge>
      </div>
    </div>
  )
}
