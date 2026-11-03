import * as React from 'react'
import { Loader2 } from 'lucide-react'

interface FieldProps {
  label: string
  value?: React.ReactNode
  isLoading?: boolean
  emptyText?: string
}

/** A read-only label/value pair, for fact grids like "Grundinformation". */
export function Field({
  label,
  value,
  isLoading,
  emptyText = '-',
}: FieldProps) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Laddar...
          </span>
        ) : (
          (value ?? emptyText)
        )}
      </p>
    </div>
  )
}
