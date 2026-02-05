import { ReactNode } from 'react'

interface ObjectPageLayoutProps {
  isLoading: boolean
  error: Error | null
  data: any | null
  notFoundMessage: string
  searchedFor?: string
  children: ReactNode
}

export const ObjectPageLayout = ({
  isLoading,
  error,
  data,
  notFoundMessage,
  searchedFor,
  children,
}: ObjectPageLayoutProps) => {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6 py-4">
        <div className="h-8 bg-secondary rounded w-64"></div>
        <div className="h-4 bg-secondary rounded w-32 mt-2"></div>
        <div className="h-[200px] bg-secondary rounded mt-6"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-10 space-y-4">
        <h2 className="text-2xl font-bold">{notFoundMessage}</h2>
        <p className="text-muted-foreground">
          Kontrollera adressen och försök igen
        </p>
        {searchedFor && (
          <p className="text-sm text-muted-foreground mt-2">
            Sökte efter: {searchedFor}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="py-4 animate-in grid grid-cols-1 lg:grid-cols-3 gap-8">
      {children}
    </div>
  )
}
