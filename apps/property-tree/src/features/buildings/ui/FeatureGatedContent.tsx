import { Card, CardContent } from '@/shared/ui/Card'

interface FeatureGatedContentProps {
  isEnabled: boolean
  children: React.ReactNode
  fallbackMessage: string
}

export const FeatureGatedContent = ({
  isEnabled,
  children,
  fallbackMessage,
}: FeatureGatedContentProps) => {
  if (isEnabled) {
    return (
      <Card>
        <CardContent className="p-4">{children}</CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          <p className="text-muted-foreground">{fallbackMessage}</p>
        </div>
      </CardContent>
    </Card>
  )
}
