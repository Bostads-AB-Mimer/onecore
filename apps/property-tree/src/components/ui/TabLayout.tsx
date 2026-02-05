import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { useIsMobile } from '@/hooks/useMobile'
import { ReactNode } from 'react'

interface TabLayoutProps {
  title?: string
  count?: number
  children: ReactNode
  className?: string
  showCard?: boolean
  showHeader?: boolean
}

export const TabLayout = ({
  title,
  count,
  children,
  className = '',
  showCard = true,
  showHeader = true,
}: TabLayoutProps) => {
  const isMobile = useIsMobile()

  if (!showCard) {
    return <div className={`space-y-6 ${className}`}>{children}</div>
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
        {children}
      </CardContent>
    </Card>
  )
}
