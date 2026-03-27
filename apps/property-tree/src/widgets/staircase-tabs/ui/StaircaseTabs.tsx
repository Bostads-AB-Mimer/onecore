import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, FilePlus } from 'lucide-react'

import { Building, ResidenceSummary, Staircase } from '@/services/types'

import { numericCompare } from '@/shared/lib/sorting'
import { paths } from '@/shared/routes'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Grid } from '@/shared/ui/Grid'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

interface StaircaseTabsProps {
  staircase: Staircase
  building: Building
  residences: ResidenceSummary[]
}

export const StaircaseTabs = ({
  staircase,
  building,
  residences,
}: StaircaseTabsProps) => {
  const navigate = useNavigate()

  const sortedResidences = residences
    .slice()
    .sort((a, b) => numericCompare(a.rentalId, b.rentalId))

  return (
    <Tabs defaultValue="residences" className="space-y-6">
      <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
        <TabsTrigger value="residences">Bostäder</TabsTrigger>
        <TabsTrigger value="work-orders">Ärenden</TabsTrigger>
      </TabsList>

      <TabsContent value="residences">
        <Card>
          <CardHeader>
            <CardTitle>Bostäder i uppgången</CardTitle>
          </CardHeader>
          <CardContent>
            <Grid cols={2}>
              {sortedResidences.map((residence) => (
                <motion.div
                  key={residence.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() =>
                    navigate(paths.residence(residence.rentalId), {
                      state: {
                        buildingCode: building.code,
                        staircaseCode: staircase.code,
                      },
                    })
                  }
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium group-hover:text-blue-500 transition-colors">
                        Lägenhet {residence.code}
                      </h3>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </motion.div>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="work-orders">
        <Card>
          <CardHeader>
            <CardTitle>Ärenden</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button disabled variant="default">
                <FilePlus className="mr-2 h-4 w-4" />
                Skapa ärende
              </Button>
              <p className="text-slate-500">
                Ärenden för uppgångar kommer snart.
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
