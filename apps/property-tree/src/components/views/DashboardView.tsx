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
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { useUser } from '@/auth/useUser'

export function DashboardView() {
  const navigate = useNavigate()
  const userState = useUser()

  // Define card configurations
  const cardConfigs = [
    {
      id: 'properties',
      title: 'Fastighetsdata',
      icon: Building,
      description: 'Hantera fastighetsbestånd och byggnader',
      path: '/companies',
      isExternal: false,
    },
    {
      id: 'tenants',
      title: 'Kunder',
      icon: Contact,
      description: 'Kundregister och hyresgästinformation',
      path: '/tenants/all',
      isExternal: false,
    },
    {
      id: 'rentals',
      title: 'Uthyrning',
      icon: Key,
      description: 'Hantera uthyrning av lägenheter',
      path: '/rentals',
      isExternal: false,
    },
    {
      id: 'barriers',
      title: 'Spärrar',
      icon: ShieldX,
      description: 'Hantera spärrar och begränsningar',
      path: '/barriers',
      isExternal: false,
    },
    {
      id: 'turnover',
      title: 'In- och utflytt',
      icon: ArrowRightLeft,
      description: 'Hantera in- och utflyttningsprocesser',
      path: '/turnover',
      isExternal: false,
    },
    {
      id: 'inspections',
      title: 'Besiktningar',
      icon: ClipboardList,
      description: 'Genomför och hantera besiktningar',
      path: '/inspections',
      isExternal: false,
    },
    {
      id: 'xledger',
      title: 'Ekonomi',
      icon: DollarSign,
      description: 'Ekonomi och redovisning',
      path: '/',
      isExternal: false,
    },
    {
      id: 'tenfast',
      title: 'Hyresadministration & avtal',
      icon: FileText,
      description: 'Hyreshantering och administration',
      path: '/',
      isExternal: false,
    },
    {
      id: 'alliera',
      title: 'Lås & passage',
      icon: Lock,
      description: 'Låssystem och passagekontroll',
      path: 'http://srvmimhk21/Alliera/Account/LogOn?ReturnUrl=%2falliera',
      isExternal: true,
    },
    {
      id: 'odoo',
      title: 'Ärendehantering (Odoo)',
      icon: MessageSquare,
      description: 'Hantera ärenden och support',
      path: 'https://odoo.mimer.nu/',
      isExternal: true,
    },
    {
      id: 'greenview',
      title: 'Greenview',
      icon: Eye,
      description: 'Översikt och rapportering',
      path: 'https://mimer.greenview.se/',
      isExternal: true,
    },
    {
      id: 'curves',
      title: 'Curves',
      icon: TrendingUp,
      description: 'IMD',
      path: 'https://curves.com',
      isExternal: true,
    },
  ]

  const handleCardClick = (config: (typeof cardConfigs)[0]) => {
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
          Hej {userState.tag === 'success' ? userState.user.name : ''} välkommen till ONECore
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
              ett ställe. Ta det i din egen takt och utforska systemet - du
              kommer att märka hur enkelt det är att navigera mellan olika
              funktioner.
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
                className={`hover:scale-105 transition-all duration-200 cursor-pointer ${
                  config.isExternal
                    ? 'bg-gradient-to-br from-background to-muted/20 border-muted-foreground/20'
                    : ''
                }`}
                onClick={() => handleCardClick(config)}
              >
                <CardHeader className="pb-3 relative">
                  <CardTitle
                    className={`flex items-center gap-3 text-lg ${
                      config.isExternal ? 'text-accent-foreground' : ''
                    }`}
                  >
                    <IconComponent className="h-5 w-5 text-primary" />
                    {config.title}
                  </CardTitle>
                  {config.isExternal && (
                    <ExternalLink className="h-4 w-4 text-muted-foreground absolute top-4 right-4" />
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {config.description}
                  </p>
                  {config.isExternal && (
                    <p className="text-xs text-muted-foreground/70 mt-2 italic">
                      Extern tjänst
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
