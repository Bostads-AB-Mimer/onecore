import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Layers,
  Home,
  Users,
  Building as BuildingIcon,
  ArrowRight,
  AlertCircle,
} from 'lucide-react'
import { buildingService, residenceService } from '../../services/api'
import { Issue } from '@/services/types'

const mockIssues: Issue[] = [
  {
    id: 'issue-1',
    description: 'Läckande kran i köket',
    priority: 'high',
    status: 'in-progress',
    room: 'Kök',
    feature: 'Vattenkran',
    date: '2024-02-01',
    residenceId: 'residence-1',
  },
  {
    id: 'issue-2',
    description: 'Trasig dörrhandtag',
    priority: 'medium',
    status: 'pending',
    room: 'Hall',
    feature: 'Ytterdörr',
    date: '2024-02-02',
    residenceId: 'residence-2',
  },
]
import { StatCard } from '../shared/StatCard'
import { ViewHeader } from '../shared/ViewHeader'
import { Card } from '@/components/ui/Card'
import { Grid } from '@/components/ui/Grid'
import { Badge } from '@/components/ui/Badge'
import { staircaseService } from '@/services/api/staircaseService'

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
  const { staircaseId, buildingId } = useParams()
  const navigate = useNavigate()
  const buildingQuery = useQuery({
    queryKey: ['building', buildingId],
    queryFn: () => buildingService.getById(buildingId!),
    enabled: !!buildingId,
  })

  const staircaseQuery = useQuery({
    queryKey: ['staircase', buildingId, staircaseId],
    queryFn: () =>
      staircaseService.getByBuildingCodeAndId(
        buildingQuery.data.code,
        staircaseId
      ),
    enabled: !!buildingId && !!staircaseId && !!buildingQuery.data?.code,
  })

  const residencesQuery = useQuery({
    queryKey: ['residences', buildingQuery.data?.code],
    queryFn: () => residenceService.getByBuildingCode(buildingQuery.data.code),
    enabled: !!buildingQuery.data?.code,
  })

  if (
    buildingQuery.isLoading ||
    staircaseQuery.isLoading ||
    residencesQuery.isLoading
  ) {
    return <LoadingSkeleton />
  }

  if (!staircaseQuery.data) {
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
        title={buildingQuery.data?.name}
        subtitle={`Byggnad ${staircaseQuery.data?.name}`}
        type="Uppgång"
        icon={Layers}
      />

      <Grid cols={3} className="mb-8">
        <StatCard
          title="Bostäder"
          value={residencesQuery.data?.length || 0}
          icon={Home}
          subtitle={`? st uthyrda`}
        />
        <StatCard title="Uthyrningsgrad" value={`? %`} icon={Users} />
        <StatCard
          title="Våningar"
          value={Math.ceil((residencesQuery.data?.length || 0) / 2)}
          icon={BuildingIcon}
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
              {residencesQuery.data?.map((residence) => (
                <motion.div
                  key={residence.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() =>
                    navigate(`/residences/${residence.id}`, {
                      state: {
                        buildingCode: buildingQuery.data?.code,
                        floorCode: residence.code.substring(2, 4),
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

          {mockIssues.length > 0 && (
            <Card title="Pågående ärenden" icon={AlertCircle}>
              <div className="space-y-4">
                {mockIssues.map((issue) => (
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
                          <Badge
                            variant={
                              issue.priority === 'high' ? 'error' : 'default'
                            }
                          >
                            {priorityLabels[issue.priority]}
                          </Badge>
                          <Badge>{statusLabels[issue.status]}</Badge>
                          <Badge variant="default">{issue.residenceId}</Badge>
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
                <div className="flex justify-between items-center mb-2 opacity-50">
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
                  <span className="text-sm font-medium opacity-50">
                    2024-02-15
                  </span>
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
