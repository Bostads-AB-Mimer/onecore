import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface AddButtonProps {
  /** Callback when button is clicked */
  onClick: () => void
  /** Button label */
  children: React.ReactNode
}

/** Primary add/create button with plus icon */
export function AddButton({ onClick, children }: AddButtonProps) {
  return (
    <Button onClick={onClick} className="bg-primary hover:bg-primary/90">
      <Plus className="h-4 w-4 mr-2" />
      {children}
    </Button>
  )
}
