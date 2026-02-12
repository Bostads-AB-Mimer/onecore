import { Alert, AlertTitle, AlertDescription } from '@/shared/ui/Alert'
import { AlertCircle } from 'lucide-react'

interface ErrorStateProps {
  message?: string
}

export const ErrorState = ({
  message = 'Ett fel uppstod vid laddning av data',
}: ErrorStateProps) => {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Fel</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
