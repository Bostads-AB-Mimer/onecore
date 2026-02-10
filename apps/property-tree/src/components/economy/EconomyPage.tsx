import { StrofakturaForm } from './components/StrofakturaForm'

export default function StrofakturaUnderlagPage() {
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
