import React from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home,
  Square,
  BedDouble,
  Wallet,
  CalendarClock,
  FileText,
  Mail,
  Phone,
} from 'lucide-react'
import { propertyService } from '../../services/api/propertyService'
import { Residence } from '../../services/types'
import { ViewHeader } from '../shared/ViewHeader'
import { Card } from '../ui/card'
import { Grid } from '../ui/grid'
import { RoomCard } from '../shared/RoomCard'
import { ActiveIssues } from '../shared/ActiveIssues'
import { StatCard } from '../shared/StatCard'
import { Button } from '../ui/button'
import { ContractModal } from '../shared/ContractModal'
import { residenceService } from '@/services/api'

function LoadingSkeleton() {
  return (
    <div className="p-8 animate-in">
      <div className="mb-8">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>

      <Grid cols={4} className="mb-8">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
          />
        ))}
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}

export function ResidenceView() {
  const { residenceId } = useParams()
  const [residence, setResidence] = React.useState<Residence | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [showContract, setShowContract] = React.useState(false)

  React.useEffect(() => {
    const loadResidence = async () => {
      try {
        const data = await residenceService.getById(residenceId!)
        setResidence(data)
      } finally {
        setLoading(false)
      }
    }
    loadResidence()
  }, [residenceId])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (!residence) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Bostad hittades inte
        </h2>
      </div>
    )
  }

  return (
    <div className="p-8 animate-in">
      <ViewHeader
        title={`${residence.bedrooms} rum och kök, ${residence.id}`}
        subtitle={residence.address}
        type="Bostad"
        icon={Home}
      />

      <Grid cols={4} className="mb-8">
        <StatCard
          title="Storlek"
          value={`${residence.size} m²`}
          icon={Square}
        />
        <StatCard title="Sovrum" value={residence.bedrooms} icon={BedDouble} />
        <StatCard
          title="Hyra"
          value={`${residence.rent} kr/mån`}
          icon={Wallet}
        />
        <StatCard
          title="Inflyttning"
          value={residence.tenant?.moveInDate}
          icon={CalendarClock}
        />
      </Grid>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2 space-y-6">
          <Card title="Rum och ytor">
            <Grid cols={2}>
              {residence.rooms?.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  residenceId={residence.id}
                />
              ))}
            </Grid>
          </Card>

          {residence.activeIssues?.name.length > 0 && (
            <ActiveIssues issues={residence.activeIssues} />
          )}
        </div>

        <div className="space-y-6">
          <Card title="Hyresgästinformation">
            <div className="flex items-center space-x-4 mb-6">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="h-12 w-12 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-lg shadow-blue-500/20"
              >
                {residence.tenant?.name.charAt(0)}
              </motion.div>
              <div>
                <p className="font-medium">{residence.tenant?.name}</p>
                <p className="text-sm text-gray-500">Nuvarande hyresgäst</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-300">
                <CalendarClock className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <div>
                  <p className="text-sm text-gray-500">Inflyttningsdatum</p>
                  <p className="font-medium group-hover:text-blue-500 transition-colors">
                    {residence.tenant?.moveInDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-300">
                <Mail className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <div>
                  <p className="text-sm text-gray-500">E-post</p>
                  <p className="font-medium group-hover:text-blue-500 transition-colors">
                    {residence.tenant?.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-300">
                <Phone className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <div>
                  <p className="text-sm text-gray-500">Telefon</p>
                  <p className="font-medium group-hover:text-blue-500 transition-colors">
                    {residence.tenant?.phone}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t dark:border-gray-700">
                <Button
                  variant="primary"
                  icon={FileText}
                  className="w-full"
                  onClick={() => setShowContract(true)}
                >
                  Visa kontrakt
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>

      {residence.tenant && (
        <ContractModal
          isOpen={showContract}
          onClose={() => setShowContract(false)}
          tenant={residence.tenant}
          residence={residence}
        />
      )}
    </div>
  )
}
