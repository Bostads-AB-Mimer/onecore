import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Layers,
  Home,
  Users,
  Building,
  ArrowRight,
  AlertCircle,
} from 'lucide-react'
import { propertyService } from '../../services/api'
import { Staircase, Issue } from '../../services/types'
import { StatCard } from '../shared/StatCard'
import { ViewHeader } from '../shared/ViewHeader'
import { Card } from '../ui/Card'
import { Grid } from '../ui/Grid'
import { Badge } from '../ui/Badge'

function LoadingSkeleton() {
  return (
    <div className="p-8 animate-in">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 animate-pulse" />
      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg mb-8 animate-pulse" />

      <Grid cols={3} className="mb-8">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
          />
        ))}
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}

const priorityColors = {
  low: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  medium:
    'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
  high: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
}

const priorityLabels = {
  low: 'Låg',
  medium: 'Medium',
  high: 'Hög',
}

const statusLabels = {
  pending: 'Väntar',
  'in-progress': 'Pågående',
  resolved: 'Åtgärdat',
}

export function StaircaseView() {
  const { staircaseId } = useParams()
  const navigate = useNavigate()
  const [staircase, setStaircase] = React.useState<Staircase | null>(null)
  const [allIssues, setAllIssues] = React.useState<Issue[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const staircaseData = await propertyService.getStaircase(staircaseId!)
        setStaircase(staircaseData)

        // Load all residences and their issues
        const residencePromises = staircaseData.residences.map((id) =>
          propertyService.getResidence(id),
        )
        const residences = await Promise.all(residencePromises)

        // Collect all issues and add residence information
        const issues = residences.flatMap((residence) =>
          residence.activeIssues.map((issue) => ({
            ...issue,
            residenceId: residence.id,
            residenceName: `Lägenhet ${residence.id}`,
          })),
        )

        setAllIssues(issues)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [staircaseId])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (!staircase) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Uppgång hittades inte
        </h2>
      </div>
    )
  }

  return (
    <div className="p-8 animate-in">
      <ViewHeader
        title={staircase.name}
        subtitle={`Byggnad ${staircase.buildingId}`}
        type="Uppgång"
        icon={Layers}
      />

      <Grid cols={3} className="mb-8">
        <StatCard
          title="Bostäder"
          value={staircase.totalResidences}
          icon={Home}
          subtitle={`${staircase.occupiedResidences} uthyrda`}
        />
        <StatCard
          title="Uthyrningsgrad"
          value={`${Math.round((staircase.occupiedResidences / staircase.totalResidences) * 100)}%`}
          icon={Users}
        />
        <StatCard
          title="Våningar"
          value={Math.ceil(staircase.totalResidences / 2)}
          icon={Building}
        />
      </Grid>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2 space-y-6">
          <Card title="Bostäder" icon={Home}>
            <Grid cols={2}>
              {staircase.residences.map((residenceId) => (
                <motion.div
                  key={residenceId}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate(`/residences/${residenceId}`)}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium group-hover:text-blue-500 transition-colors">
                        Lägenhet {residenceId}
                      </h3>
                      <p className="text-sm text-gray-500">
                        3 rum och kök, 75m²
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </motion.div>
              ))}
            </Grid>
          </Card>

          {allIssues.length > 0 && (
            <Card title="Pågående ärenden" icon={AlertCircle}>
              <div className="space-y-4">
                {allIssues.map((issue) => (
                  <motion.div
                    key={issue.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
                    onClick={() => navigate(`/residences/${issue.residenceId}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant={issue.priority as any}>
                            {priorityLabels[issue.priority]}
                          </Badge>
                          <Badge>{statusLabels[issue.status]}</Badge>
                          <Badge variant="default">{issue.residenceName}</Badge>
                        </div>
                        <p className="font-medium group-hover:text-blue-500 transition-colors">
                          {issue.description}
                        </p>
                        <div className="flex items-center text-sm text-gray-500">
                          <span>{issue.room}</span>
                          <span className="mx-2">•</span>
                          <span>{issue.feature}</span>
                          <span className="mx-2">•</span>
                          <span>{issue.date}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Status" icon={Layers}>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">Portkod</span>
                  <span className="text-sm font-medium">1234#</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">Städning</span>
                  <span className="text-sm font-medium text-green-500">
                    Utförd
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    Senaste inspektion
                  </span>
                  <span className="text-sm font-medium">2024-02-15</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Nästa städning</span>
                  <span className="text-sm font-medium">2024-03-01</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    Nästa inspektion
                  </span>
                  <span className="text-sm font-medium">2024-08-15</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  )
}
