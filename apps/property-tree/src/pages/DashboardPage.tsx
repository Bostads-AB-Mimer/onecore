import { useNavigate } from 'react-router-dom'

import {
  type DashboardCard,
  DashboardCardItem,
  dashboardCards,
} from '@/widgets/dashboard'

import { useUser } from '@/entities/user'

import onecoreLogo from '@/shared/assets/logos/stacked/onecore_logo_stacked_black.svg'
import { Card, CardContent } from '@/shared/ui/Card'
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

      <Card className="max-w-2xl mx-auto hover:shadow-xl transition-shadow duration-200">
        <CardContent className="p-8 text-center space-y-4">
          <p className="text-lg leading-relaxed text-muted-foreground">
            Vi är glada att ha dig här! ONECore är din digitala arbetsplats där
            allt du behöver för att göra ditt bästa arbete finns samlat på ett
            ställe. Ta det i din egen takt och utforska systemet - allt finns
            ännu inte på plats utan vi uppdaterar löpande.
          </p>
          <p className="text-base text-muted-foreground">
            Har du frågor eller behöver hjälp? Tveka inte att höra av dig till{' '}
            <span className="font-semibold text-primary">David</span> eller{' '}
            <span className="font-semibold text-primary">Lina</span> - vi finns
            här för att stötta dig!
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {dashboardCards.map((config, index) => (
          <DashboardCardItem
            key={config.id}
            config={config}
            index={index}
            onClick={handleCardClick}
          />
        ))}
      </div>
    </ViewLayout>
  )
}
