import React from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Maximize2, DoorOpen, Wrench } from 'lucide-react'

import { Room, Component, Issue } from '../services/types'
import { Card } from '@/shared/ui/Card'
import { Grid } from '@/shared/ui/Grid'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'
import { ComponentList } from '../features/component-library'
import { ActiveIssues } from '../features/rooms/ui/ActiveIssues'

export function RoomView() {
  const { roomId, apartmentId } = useParams()
  const [room, setRoom] = React.useState<Room | null>(null)
  const [components, setComponents] = React.useState<Component[]>([])
  const [issues, setIssues] = React.useState<Issue[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    const loadRoom = async () => {
      try {
        // In a real app, these would be actual API calls
        const roomData = await fetch(`/api/rooms/${roomId}`).then((res) =>
          res.json()
        )
        const componentsData = await fetch(
          `/api/rooms/${roomId}/components`
        ).then((res) => res.json())
        const issuesData = await fetch(`/api/rooms/${roomId}/issues`).then(
          (res) => res.json()
        )

        setRoom(roomData)
        setComponents(componentsData)
        setIssues(issuesData)
      } catch (err) {
        console.error('Failed to load room data:', err)
        setError(err instanceof Error ? err : new Error('Failed to load room'))
      } finally {
        setLoading(false)
      }
    }

    loadRoom()
  }, [roomId])

  const handleAddComponent = async (_data: unknown) => {
    // TODO: Implementation for adding a component
  }

  const handleEditComponent = async (_id: string, _data: unknown) => {
    // TODO: Implementation for editing a component
  }

  const handleViewComponent = (_component: Component) => {
    // TODO: Implementation for viewing a component
  }

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={loading}
        error={error}
        data={room}
        notFoundMessage="Rummet kunde inte hittas"
        searchedFor={roomId}
      >
        {(room) => (
          <>
            <h1 className="text-3xl font-bold mb-2">{room.name ?? ''}</h1>
            <p className="text-muted-foreground mb-8">Lägenhet {apartmentId}</p>

            <Grid cols={3} className="mb-8">
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Maximize2 className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Storlek</p>
                      <p className="font-medium">{room.roomType?.name} ?</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <DoorOpen className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Fönster</p>
                      <p className="font-medium">? st</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Wrench className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Funktioner</p>
                      <p className="font-medium">
                        {Object.values(room.features).filter(Boolean).length} st
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </Grid>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-2 space-y-6">
                <Card title="Funktioner">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(room.features).map((feature, index) => (
                      <Badge key={index} variant="default">
                        {feature}
                      </Badge>
                    ))}
                    <Button variant="outline" disabled>
                      Lägg till
                    </Button>
                  </div>
                </Card>

                <ComponentList
                  components={components}
                  rooms={room.name ? [room.name] : []}
                  onAddComponent={handleAddComponent}
                  onEditComponent={handleEditComponent}
                  onViewComponent={handleViewComponent}
                />

                {issues.length > 0 && <ActiveIssues issues={issues} />}
              </div>

              <div className="space-y-6">
                <Card title="Åtgärder">
                  <div className="space-y-3">
                    <Button variant="link" className="w-full" disabled>
                      Registrera ärende
                    </Button>
                    <Button variant="secondary" className="w-full" disabled>
                      Planera underhåll
                    </Button>
                    <Button variant="secondary" className="w-full" disabled>
                      Ruminställningar
                    </Button>
                  </div>
                </Card>

                <Card title="Status">
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500">Skick</span>
                        <span className="text-sm font-medium text-green-500">
                          Gott
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500">
                          Senaste besiktning
                        </span>
                        <span className="text-sm font-medium">2024-01-15</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Nästa underhåll
                        </span>
                        <span className="text-sm font-medium">2024-06-01</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </motion.div>
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}
