import { useNavigate } from 'react-router-dom'
import { ArrowRight, FilePlus, Home, MessageSquare } from 'lucide-react'

import { linkToOdooCreateMaintenanceRequestForContext } from '@/shared/lib/odooUtils'

import { Building, ResidenceSummary, Staircase } from '@/services/types'

import { numericCompare } from '@/shared/lib/sorting'
import { paths } from '@/shared/routes'
import { ContextType } from '@/shared/types/ui'
import { Button } from '@/shared/ui/Button'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

interface StaircaseTabsMobileProps {
  staircase: Staircase
  building: Building
  residences: ResidenceSummary[]
  propertyCode?: string
  organizationNumber?: string
}

export function StaircaseTabsMobile({
  staircase,
  building,
  residences,
  propertyCode,
  organizationNumber,
}: StaircaseTabsMobileProps) {
  const navigate = useNavigate()

  const sortedResidences = residences
    .slice()
    .sort((a, b) => numericCompare(a.rentalId, b.rentalId))

  const accordionItems: MobileAccordionItem[] = [
    {
      id: 'residences',
      icon: Home,
      title: 'Bostäder',
      content: (
        <div className="space-y-2">
          {sortedResidences.map((residence) => (
            <div
              key={residence.id}
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
              className="p-3 bg-gray-50 rounded-lg cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium group-hover:text-blue-500 transition-colors">
                  Lägenhet {residence.code}
                </h3>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'work-orders',
      icon: MessageSquare,
      title: 'Ärenden',
      content: (
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
    },
  ]

  return (
    <MobileAccordion
      items={accordionItems}
      defaultOpen={['residences']}
      className="space-y-3"
    />
  )
}
