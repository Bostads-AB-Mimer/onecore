import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/Accordion'

export interface MobileAccordionItem {
  id: string
  title: string
  content: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  disabled?: boolean
}
interface MobileAccordionProps {
  items: MobileAccordionItem[]
  defaultOpen?: string[]
  className?: string
}
export function MobileAccordion({
  items,
  defaultOpen = [],
  className = '',
}: MobileAccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>(defaultOpen)
  const handleValueChange = (value: string[]) => {
    setOpenItems(value)
  }
  return (
    <div className={`${className}`}>
      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={handleValueChange}
        className="space-y-2"
      >
        {items.map((item) => (
          <AccordionItem
            key={item.id}
            value={item.id}
            disabled={item.disabled}
            className="rounded-lg border border-slate-200"
          >
            <AccordionTrigger className="px-2 py-2">
              <div className="flex items-center gap-2">
                {item.icon && (
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-base font-medium">{item.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-0 pb-2">{item.content}</div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
