import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { SegmentedTabs, useRouteTab } from '@onecore/ui'
import { motion } from 'framer-motion'
import { ArrowRight, FilePlus } from 'lucide-react'

import { Building, ResidenceSummary, Staircase } from '@/services/types'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { linkToOdooCreateMaintenanceRequestForContext } from '@/shared/lib/odooUtils'
import { numericCompare } from '@/shared/lib/sorting'
import { paths } from '@/shared/routes'
import { ContextType } from '@/shared/types/ui'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Grid } from '@/shared/ui/Grid'
import { TabsAccordion } from '@/shared/ui/TabsAccordion'

import {
  STAIRCASE_DEFAULT_TAB,
  STAIRCASE_TABS,
  type StaircaseTab,
} from '../model/tabs'

interface StaircaseTabsProps {
  staircase: Staircase
  building: Building
  residences: ResidenceSummary[]
  propertyCode?: string
  organizationNumber?: string
}

const TITLES: Record<StaircaseTab, string> = {
  bostader: 'Bostäder i uppgången',
  arenden: 'Ärenden',
}

export const StaircaseTabs = ({
  staircase,
  building,
  residences,
  propertyCode,
  organizationNumber,
}: StaircaseTabsProps) => {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { value, basePath } = useRouteTab(STAIRCASE_TABS, STAIRCASE_DEFAULT_TAB)

  const sortedResidences = residences
    .slice()
    .sort((a, b) => numericCompare(a.rentalId, b.rentalId))

  const content: Record<StaircaseTab, ReactNode> = {
    bostader: (
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
                  propertyCode,
                  organizationNumber,
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
    ),
    arenden: (
      <div className="space-y-4">
        <Button
          variant="default"
          onClick={() =>
            linkToOdooCreateMaintenanceRequestForContext(
              ContextType.Staircase,
              building.code
            )
          }
        >
          <FilePlus className="mr-2 h-4 w-4" />
          Skapa ärende
        </Button>
      </div>
    ),
  }

  if (isMobile) {
    return (
      <TabsAccordion tabs={STAIRCASE_TABS} content={content} open={value} />
    )
  }

  return (
    <div className="space-y-6">
      <SegmentedTabs tabs={STAIRCASE_TABS} value={value} basePath={basePath} />
      <Card>
        <CardHeader>
          <CardTitle>{TITLES[value]}</CardTitle>
        </CardHeader>
        <CardContent>{content[value]}</CardContent>
      </Card>
    </div>
  )
}
