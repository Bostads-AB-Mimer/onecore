import { ImdUploadForm } from '@/features/imd/components/ImdUploadForm'

import { ViewLayout } from '@/shared/ui/layout'

export function ImdPage() {
  return (
    <ViewLayout className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">IMD-bearbetning</h1>
          <p className="text-muted-foreground mt-1">
            Ladda upp IMD-data för berikning och export till Tenfast
          </p>
        </div>
      </div>

      <ImdUploadForm />
    </ViewLayout>
  )
}
