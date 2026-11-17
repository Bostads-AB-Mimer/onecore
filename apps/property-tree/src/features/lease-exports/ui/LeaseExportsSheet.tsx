import { CircleAlert, Download } from 'lucide-react'

import { useLeaseExports } from '@/entities/lease'

import { Button } from '@/shared/ui/Button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/Sheet'
import { Skeleton } from '@/shared/ui/Skeleton'

import { useLeaseExportsSheet } from '../hooks/useLeaseExportsSheet'
import { LeaseExportCard } from './LeaseExportCard'

export function LeaseExportsSheet() {
  const { isOpen, close } = useLeaseExportsSheet()
  const { exports, isLoading, isError, refetch } = useLeaseExports()

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b p-4 text-left">
          <SheetTitle>Mina exporter</SheetTitle>
          <SheetDescription>
            Exporter från de senaste 7 dagarna. Filer raderas efter 7 dagar.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 p-4">
          {isLoading ? (
            <div className="flex flex-col gap-3" aria-busy>
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border p-4">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="mt-3 h-3 w-4/5" />
                  <Skeleton className="mt-2 h-3 w-2/5" />
                  <Skeleton className="mt-4 h-9 w-32" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <SheetMessage
              icon={
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <CircleAlert className="h-6 w-6" />
                </span>
              }
              title="Något gick fel"
              description="Det gick inte att hämta dina exporter. Försök igen om en stund."
            >
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => refetch()}
              >
                Försök igen
              </Button>
            </SheetMessage>
          ) : exports.length === 0 ? (
            <SheetMessage
              icon={
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Download className="h-6 w-6" />
                </span>
              }
              title="Inga exporter"
              description="Inga exporter de senaste 7 dagarna. Exportera från Hyreskontrakt så hamnar filen här."
            />
          ) : (
            exports.map((leaseExport) => (
              <LeaseExportCard key={leaseExport.id} leaseExport={leaseExport} />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface SheetMessageProps {
  icon: React.ReactNode
  title: string
  description: string
  children?: React.ReactNode
}

function SheetMessage({
  icon,
  title,
  description,
  children,
}: SheetMessageProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-14 text-center">
      {icon}
      <h3 className="mt-1 text-base font-semibold">{title}</h3>
      <p className="max-w-[340px] text-sm text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  )
}
