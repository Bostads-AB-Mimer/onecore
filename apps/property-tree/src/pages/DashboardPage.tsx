import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRightLeft,
  Building,
  Calendar,
  ClipboardList,
  Contact,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Home,
  Key,
  Lock,
  MessageSquare,
  ShieldX,
  TrendingUp,
} from 'lucide-react'

import { useUser } from '@/entities/user'

import type { DashboardCard } from '@/services/types'

import onecoreLogo from '@/shared/assets/logos/stacked/onecore_logo_stacked_black.svg'
import { resolve } from '@/shared/lib/env'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { ViewLayout } from '@/shared/ui/layout'

const cardConfigs: DashboardCard[] = [
  {
    id: 'properties',
    title: 'Fastighetsdata',
    icon: Building,
    description: 'Hantera fastighetsbestånd och byggnader',
    path: resolve('VITE_PROPERTYTREE', ''),
    isExternal: false,
    isDisabled: false,
  },
  {
    id: 'tenants',
    title: 'Kunder',
    icon: Contact,
    description: 'Kundregister och hyresgästinformation',
    path: '/tenants',
    isExternal: false,
    isDisabled: false,
  },
  {
    id: 'rental',
    title: 'Uthyrning',
    icon: Home,
    description: 'Hantera uthyrning av lägenheter',
    path: resolve('VITE_INTERNAL_PORTAL', ''),
    isExternal: true,
    isDisabled: false,
  },
  {
    id: 'viewings',
    title: 'Visningar',
    icon: Calendar,
    description: 'Planera och hantera visningar',
    path: resolve('VITE_VIEWINGS', ''),
    isExternal: true,
    isDisabled: false,
  },
  {
    id: 'odoo',
    title: 'Ärendehantering (Odoo)',
    icon: MessageSquare,
    description: 'Hantera ärenden och support',
    path: resolve('VITE_ODOO_URL', ''),
    isExternal: true,
    isDisabled: false,
  },
  {
    id: 'xledger',
    title: 'Ekonomi',
    icon: DollarSign,
    description: 'Ekonomi och redovisning',
    path: resolve('VITE_XLEDGER_URL', ''),
    isExternal: true,
    isDisabled: false,
  },
  {
    id: 'passage',
    title: 'Passage',
    icon: Lock,
    description: 'Låssystem och passagekontroll',
    path: resolve('VITE_PASSAGE_URL', ''),
    isExternal: true,
    isDisabled: false,
  },
  {
    id: 'greenview',
    title: 'Greenview',
    icon: Eye,
    description: 'Översikt och rapportering',
    path: resolve('VITE_GREENVIEW_URL', ''),
    isExternal: true,
    isDisabled: false,
  },
  {
    id: 'curves',
    title: 'Curves',
    icon: TrendingUp,
    description: 'IMD',
    path: resolve('VITE_CURVES_URL', ''),
    isExternal: true,
    isDisabled: false,
  },
  {
    id: 'keys',
    title: 'Nycklar',
    icon: Key,
    description: 'Nyckelhantering',
    path: resolve('VITE_KEYS_URL', ''),
    isExternal: true,
    isDisabled: true,
  },
  {
    id: 'rental-blocks',
    title: 'Spärrar',
    icon: ShieldX,
    description: 'Hantera spärrar och begränsningar',
    path: '/rental-blocks',
    isExternal: false,
    isDisabled: false,
  },
  {
    id: 'turnover',
    title: 'In- och utflytt',
    icon: ArrowRightLeft,
    description: 'Hantera in- och utflyttningsprocesser',
    path: '/turnover',
    isExternal: false,
    isDisabled: true,
  },
  {
    id: 'inspections',
    title: 'Besiktningar',
    icon: ClipboardList,
    description: 'Genomför och hantera besiktningar',
    path: '/inspections',
    isExternal: false,
    isDisabled: false,
  },
  {
    id: 'tenfast',
    title: 'Hyresadministration & avtal',
    icon: FileText,
    description: 'Hyreshantering och administration',
    path: resolve('VITE_TENFAST_URL', ''),
    isExternal: true,
    isDisabled: true,
  },
].map((card) => ({
  ...card,
  isDisabled: card.isDisabled || !card.path,
}))

function DashboardCardItem({
  config,
  index,
  onClick,
}: {
  config: DashboardCard
  index: number
  onClick: (config: DashboardCard) => void
}) {
  const Icon = config.icon

  return (
    <motion.div
      key={config.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05 }}
    >
      <Card
        className={`h-full transition-all duration-200 ${
          config.isDisabled
            ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
            : 'hover:scale-105 cursor-pointer'
        }`}
        onClick={() => onClick(config)}
      >
        <CardHeader className="pb-3 relative">
          <CardTitle
            className={`flex items-center gap-3 text-lg ${config.isDisabled ? 'text-gray-400 dark:text-gray-600' : ''}`}
          >
            <Icon
              className={`h-5 w-5 ${config.isDisabled ? 'text-gray-400 dark:text-gray-600' : 'text-primary'}`}
            />
            {config.title}
          </CardTitle>
          {config.isExternal && !config.isDisabled && (
            <ExternalLink className="h-4 w-4 text-muted-foreground absolute top-4 right-4" />
          )}
        </CardHeader>
        <CardContent>
          <p
            className={`text-sm ${config.isDisabled ? 'text-gray-400 dark:text-gray-600' : 'text-muted-foreground'}`}
          >
            {config.description}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

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
        {cardConfigs.map((config, index) => (
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
