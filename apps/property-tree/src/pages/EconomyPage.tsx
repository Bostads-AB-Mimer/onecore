import { StrofakturaForm } from '../components/economy/components/StrofakturaForm'

export function EconomyPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Ströfaktura underlag
        </h1>
        <p className="text-muted-foreground">
          Hantera underlag för ströfakturering
        </p>
      </div>

      <StrofakturaForm />
    </div>
  )
}
