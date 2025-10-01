import { Residence, Staircase } from '@/services/types'
import { BuildingEntranceHierarchy } from './BuildingEntranceHierarchy'
import { TabLayout } from '@/components/ui/TabLayout'
import { Users } from 'lucide-react'

interface BuildingEntrancesProps {
  staircases: Staircase[]
  basePath: string
}

export const BuildingEntrances = ({
  staircases,
  basePath,
}: BuildingEntrancesProps) => {
  return (
    <TabLayout
      title="Uppgångar"
      count={staircases?.length || 0}
      showCard={true}
    >
      <BuildingEntranceHierarchy staircases={staircases} basePath={basePath} />
    </TabLayout>
  )
}
