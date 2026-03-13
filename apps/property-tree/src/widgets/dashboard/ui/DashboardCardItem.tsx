import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'

import type { DashboardCard } from '../types'

export function DashboardCardItem({
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
