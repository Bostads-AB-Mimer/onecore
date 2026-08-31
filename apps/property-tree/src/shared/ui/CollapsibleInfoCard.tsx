import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/Collapsible'

interface CollapsibleInfoCardProps {
  title: string
  previewContent: React.ReactNode
  children: React.ReactNode
}

export const CollapsibleInfoCard = ({
  title,
  previewContent,
  children,
}: CollapsibleInfoCardProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const isMobile = useIsMobile()

  if (!isMobile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">{children}</CardContent>
      </Card>
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{title}</CardTitle>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-3 pb-4">{previewContent}</CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border mx-6 mb-4"></div>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
