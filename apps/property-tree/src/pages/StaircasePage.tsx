import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Building as BuildingIcon, Home } from 'lucide-react'

import { useStaircaseDetails } from '@/features/buildings'

import { paths } from '@/shared/routes'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Grid } from '@/shared/ui/Grid'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'
import { StatCard } from '@/shared/ui/StatCard'

export function StaircasePage() {
  const { staircaseCode, buildingCode } = useParams()
  const navigate = useNavigate()
  const { building, staircase, residences, isLoading, error } =
    useStaircaseDetails(buildingCode, staircaseCode)

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={isLoading}
        error={error}
        data={staircase}
        notFoundMessage="Uppgång hittades inte"
        searchedFor={staircaseCode}
      >
        <h1 className="text-3xl font-bold mb-2">{building?.name}</h1>
        <p className="text-muted-foreground mb-8">Uppgång {staircase?.name}</p>

        <Grid cols={3} className="mb-8">
          <StatCard
            title="Bostäder"
            value={residences?.length || 0}
            icon={Home}
            //subtitle={`? st uthyrda`}
            subtitle=""
          />
          {/* Hiding for demo purposes */}
          {/*
        <StatCard title="Uthyrningsgrad" value={`? %`} icon={Users} />
        */}
          <StatCard
            title="Våningar"
            value={Math.ceil((residences?.length || 0) / 2)}
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
            <Card>
              <CardHeader>
                <CardTitle>
                  <Home className="h-5 w-5" />
                  Bostäder
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Grid cols={2}>
                  {residences?.map((residence) => (
                    <motion.div
                      key={residence.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() =>
                        navigate(paths.residence(residence.id), {
                          state: {
                            buildingCode: building?.code,
                            staircaseCode: residence.code.substring(2, 4),
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
                          {/* Hiding for demo purposes */}
                          {/*
                      <p className="text-sm text-gray-500">
                        3 rum och kök, 75m²
                      </p>
                      */}
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </Grid>
              </CardContent>
            </Card>
            {/* Hiding for demo purposes */}
            {/*
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
                    onClick={() => navigate(paths.residence(issue.residenceId))}
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
          */}
          </div>

          <div className="space-y-6">
            {/* Hiding for demo purposes */}
            {/*
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
          */}
          </div>
        </motion.div>
      </ObjectPageLayout>
    </ViewLayout>
  )
}
