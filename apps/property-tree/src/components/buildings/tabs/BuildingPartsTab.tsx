//import { MaintenanceUnitCard } from "@/components/design-system/showcase/maintenance/MaintenanceUnitCard";
import { TabLayout } from '@/components/ui/TabLayout'
import { Building2 } from 'lucide-react'
import type { Building } from '@/services/types'

interface BuildingPartsTabProps {
  building: Building
}

export const BuildingPartsTab = ({ building }: BuildingPartsTabProps) => {
  const buildingParts = [
    {
      subComponents: [
        {
          name: 'Tak',
          specs: {
            ekonomiskLivslangd: '30 år',
            tekniskLivslangd: '50 år',
            year: '1973',
            quantity: '1450 m²',
            brand: 'Skanditegel AB',
            model: 'Betongpannor standard',
          },
        },
        {
          name: 'Tegelpannor',
          specs: {
            ekonomiskLivslangd: '30 år',
            tekniskLivslangd: '50 år',
            year: '1973',
            quantity: '1200 m²',
            brand: 'Benders AB',
            model: 'Gamla Uppsala röd',
          },
        },
        {
          name: 'Rökucka',
          specs: {
            ekonomiskLivslangd: '25 år',
            tekniskLivslangd: '40 år',
            year: '1973',
            quantity: '8 st',
            brand: 'Schiedel AB',
            model: 'Rondo Plus',
          },
        },
        {
          name: 'Täckplåt',
          specs: {
            ekonomiskLivslangd: '20 år',
            tekniskLivslangd: '35 år',
            year: '1990',
            quantity: '150 m²',
            brand: 'Plannja AB',
            model: 'Takplåt standard',
          },
        },
      ],
    },
    {
      subComponents: [
        {
          name: 'Fasad',
          specs: {
            ekonomiskLivslangd: '25 år',
            tekniskLivslangd: '40 år',
            year: '1973',
            quantity: '2800 m²',
            brand: 'Ytong AB',
            model: 'Gasbetong puts',
          },
        },
        {
          name: 'Panel',
          specs: {
            ekonomiskLivslangd: '15 år',
            tekniskLivslangd: '25 år',
            year: '2010',
            quantity: '450 m²',
            brand: 'Svensk Trä AB',
            model: 'Stående träpanel',
          },
        },
        {
          name: 'Väggfärg',
          specs: {
            ekonomiskLivslangd: '8 år',
            tekniskLivslangd: '12 år',
            year: '2020',
            quantity: '2800 m²',
            brand: 'Beckers AB',
            model: 'Fasadfärg akryl',
          },
        },
      ],
    },
    {
      subComponents: [
        {
          name: 'Fönster',
          specs: {
            ekonomiskLivslangd: '20 år',
            tekniskLivslangd: '30 år',
            year: '1995',
            quantity: '96 st',
            brand: 'Elitfönster AB',
            model: 'Trä/aluminium 3-glas',
          },
        },
        {
          name: 'Glas',
          specs: {
            ekonomiskLivslangd: '25 år',
            tekniskLivslangd: '40 år',
            year: '1995',
            quantity: '240 m²',
            brand: 'Pilkington AB',
            model: '3-glas energi',
          },
        },
        {
          name: 'Fönsterkarmar',
          specs: {
            ekonomiskLivslangd: '20 år',
            tekniskLivslangd: '30 år',
            year: '1995',
            quantity: '96 st',
            brand: 'Elitfönster AB',
            model: 'Trä/aluminium ram',
          },
        },
      ],
    },
  ]

  return (
    <TabLayout title="Byggnadsdelar" showCard={true}>
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {buildingParts.map((part, index) => (
          <>

          </> /*<MaintenanceUnitCard key={index} subComponents={part.subComponents} />*/
        ))}
      </div>
    </TabLayout>
  )
}
