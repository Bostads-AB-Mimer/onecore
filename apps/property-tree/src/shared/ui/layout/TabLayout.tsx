import { ReactNode } from 'react'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'

interface TabLayoutProps {
  title?: string
  count?: number
  children: ReactNode
  className?: string
  showCard?: boolean
  showHeader?: boolean
  /** Show loading state */
  isLoading?: boolean
  /** Custom loading content (defaults to skeleton) */
  loadingContent?: ReactNode
  /** Error to display */
  error?: Error | null
  /** Custom error message */
  errorMessage?: string
}

const DefaultLoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
    </div>
  </div>
)

const ErrorDisplay = ({ message }: { message: string }) => (
  <div className="p-8 text-center">
    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
      {message}
    </h2>
  </div>
)

export const TabLayout = ({
  title,
  count,
  children,
  className = '',
  showCard = true,
  showHeader = true,
  isLoading = false,
  loadingContent,
  error,
  errorMessage,
}: TabLayoutProps) => {
  const isMobile = useIsMobile()

  // Determine what content to show
  const getContent = () => {
    if (isLoading) {
      return loadingContent ?? <DefaultLoadingSkeleton />
    }
    if (error) {
      return <ErrorDisplay message={errorMessage ?? 'Ett fel uppstod'} />
    }
    return children
  }

  if (!showCard) {
    return <div className={`space-y-6 ${className}`}>{getContent()}</div>
  }

  return (
    <Card className={`w-full ${className}`}>
      {title && showHeader && !isMobile && (
        <CardHeader>
          <CardTitle>
            {title}
            {count !== undefined && ` (${count})`}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent
        className={`space-y-6 ${isMobile && title && showHeader ? 'pt-6' : ''}`}
      >
        {getContent()}
      </CardContent>
    </Card>
  )
}
