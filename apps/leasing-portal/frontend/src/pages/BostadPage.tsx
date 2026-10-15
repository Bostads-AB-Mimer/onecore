import { VacantApartmentsTable } from './bostad/VacantApartmentsTable'

/** The Bostad landing page: apartments that are ready to be published. */
export function BostadPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Bostad</h1>
      <VacantApartmentsTable />
    </div>
  )
}
