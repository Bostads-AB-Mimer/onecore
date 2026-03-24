import { useNavigate } from 'react-router-dom'
// import { motion } from 'framer-motion'

import {
  type DashboardCard,
  DashboardCardItem,
  dashboardCards,
  // ReleaseNotesCard,
} from '@/widgets/dashboard'

import { GlobalSearchBar } from '@/features/search'

import { useUser } from '@/entities/user'

import onecoreLogo from '@/shared/assets/logos/stacked/onecore_logo_stacked_black.svg'
import { ViewLayout } from '@/shared/ui/layout'

export function DashboardPage() {
  const navigate = useNavigate()
  const userState = useUser()

  const givenName =
    userState.tag === 'success' ? userState.user.name.split(' ')[0] : ''

  const handleCardClick = (config: DashboardCard) => {
    if (config.isDisabled) return

    if (config.isExternal) {
      window.open(config.path, '_blank')
    } else {
      navigate(config.path)
    }
  }

  return (
    <ViewLayout className="space-y-6">
      <header className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Hej {givenName} välkommen till</h1>
        <img src={onecoreLogo} alt="OneCore" className="h-20 md:h-24 mx-auto" />
      </header>

      <div className="mx-auto max-w-2xl sm:hidden">
        <GlobalSearchBar placeholder="Sök..." />
      </div>

      <div className="flex flex-col lg:flex-row justify-center gap-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-fit">
          {dashboardCards.map((config, index) => (
            <DashboardCardItem
              key={config.id}
              config={config}
              index={index}
              onClick={handleCardClick}
            />
          ))}
        </div>
        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="order-first lg:order-last lg:w-80 lg:flex-shrink-0"
        >
          <ReleaseNotesCard />
        </motion.div> */}
      </div>
    </ViewLayout>
  )
}
