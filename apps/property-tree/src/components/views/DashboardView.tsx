import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Contact,
  Key,
  ShieldX,
  ArrowRightLeft,
  ClipboardList,
  Building,
  DollarSign,
  FileText,
  Lock,
  MessageSquare,
  Eye,
  ExternalLink,
  TrendingUp,
  Home,
  Calendar,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { useUser } from '@/auth/useUser'
import type { DashboardCard } from '@/services/types'
import { resolve } from '@/utils/env'

export function DashboardView() {
  const navigate = useNavigate()
  const userState = useUser()

  // Define card configurations
  const cardConfigs: DashboardCard[] = [
    // Active cards
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
      id: 'tenants',
      title: 'Kunder',
      icon: Contact,
      description: 'Kundregister och hyresgästinformation',
      path: resolve('VITE_CLIENTS_URL', ''),
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
      id: 'odoo',
      title: 'Ärendehantering (Odoo)',
      icon: MessageSquare,
      description: 'Hantera ärenden och support',
      path: resolve('VITE_ODOO_URL', ''),
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
      id: 'tenants',
      title: 'Kunder',
      icon: Contact,
      description: 'Kundregister och hyresgästinformation',
      path: resolve('VITE_TENANTS_URL', ''),
      isExternal: true,
      isDisabled: false,
    },

    // Disabled cards (not yet implemented)
    {
      id: 'barriers',
      title: 'Spärrar',
      icon: ShieldX,
      description: 'Hantera spärrar och begränsningar',
      path: '/barriers',
      isExternal: false,
      isDisabled: true,
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
      isDisabled: true,
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

  const handleCardClick = (config: DashboardCard) => {
    if (config.isDisabled) {
      return
    }

    if (config.isExternal) {
      window.open(config.path, '_blank')
    } else {
      navigate(config.path)
    }
  }

  return (
    <div className="p-8 space-y-6 animate-in">
      <header className="text-center space-y-3">
        <h1 className="text-3xl font-bold">
          Hej {userState.tag === 'success' ? userState.user.name : ''} välkommen
          till ONECore
        </h1>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-2xl mx-auto"
      >
        <Card className="hover:shadow-xl transition-shadow duration-200">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-lg leading-relaxed text-muted-foreground">
              Vi är glada att ha dig här! ONECore är din digitala arbetsplats
              där allt du behöver för att göra ditt bästa arbete finns samlat på
              ett ställe. Ta det i din egen takt och utforska systemet - allt
              finns ännu inte på plats utan vi uppdaterar löpande.
            </p>
            <p className="text-base text-muted-foreground">
              Har du frågor eller behöver hjälp? Tveka inte att höra av dig till{' '}
              <span className="font-semibold text-primary">David</span> eller{' '}
              <span className="font-semibold text-primary">Lina</span> - vi
              finns här för att stötta dig!
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {cardConfigs.map((config, index) => {
          const IconComponent = config.icon
          return (
            <motion.div
              key={config.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Card
                className={`transition-all duration-200 ${
                  config.isDisabled
                    ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                    : 'hover:scale-105 cursor-pointer'
                }`}
                onClick={() => handleCardClick(config)}
              >
                <CardHeader className="pb-3 relative">
                  <CardTitle
                    className={`flex items-center gap-3 text-lg ${config.isDisabled ? 'text-gray-400 dark:text-gray-600' : ''}`}
                  >
                    <IconComponent
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
        })}
      </div>
    </div>
  )
}
