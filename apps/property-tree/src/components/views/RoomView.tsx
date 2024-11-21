import React from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BedDouble,
  ChefHat,
  ShowerHead,
  Sofa,
  Home,
  Maximize2,
  DoorOpen,
  Wrench,
  Plus,
  Settings,
  AlertCircle,
} from 'lucide-react'
import { Room, Component, Issue } from '../../services/types'
import { ViewHeader } from '../shared/ViewHeader'
import { Card } from '../ui/Card'
import { Grid } from '../ui/Grid'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ComponentList } from '../shared/ComponentList'
import { ActiveIssues } from '../shared/ActiveIssues'

const roomIcons = {
  bedroom: BedDouble,
  kitchen: ChefHat,
  bathroom: ShowerHead,
  living: Sofa,
  other: Home,
}

function LoadingSkeleton() {
  return (
    <div className="p-8 animate-in">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Features Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>

          {/* Components Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Side Panel Skeleton */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RoomView() {
  const { roomId, apartmentId } = useParams()
  const [room, setRoom] = React.useState<Room | null>(null)
  const [components, setComponents] = React.useState<Component[]>([])
  const [issues, setIssues] = React.useState<Issue[]>([])
  const [loading, setLoading] = React.useState(true)

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
      } catch (error) {
        console.error('Failed to load room data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRoom()
  }, [roomId])

  if (loading) return <LoadingSkeleton />
  if (!room) return <div>Room not found</div>

  const Icon = roomIcons[room.type] || Home

  const handleAddComponent = async (data: any) => {
    // Implementation for adding a component
    console.log('Adding component:', data)
  }

  const handleEditComponent = async (id: string, data: any) => {
    // Implementation for editing a component
    console.log('Editing component:', id, data)
  }

  const handleViewComponent = (component: Component) => {
    // Implementation for viewing a component
    console.log('Viewing component:', component)
  }

  return (
    <div className="p-8 animate-in">
      <ViewHeader
        title={room.name}
        subtitle={`Lägenhet ${apartmentId}`}
        type="Rum"
        icon={Icon}
      />

      <Grid cols={3} className="mb-8">
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Maximize2 className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Storlek</p>
                <p className="font-medium">{room.size} m²</p>
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
                <p className="font-medium">{room.windows} st</p>
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
                <p className="font-medium">{room.features.length} st</p>
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
          <Card title="Funktioner" icon={Settings}>
            <div className="flex flex-wrap gap-2">
              {room.features.map((feature, index) => (
                <Badge
                  key={index}
                  icon={AlertCircle}
                  variant="default"
                  onClick={() => console.log('Feature clicked:', feature)}
                >
                  {feature}
                </Badge>
              ))}
              <Button
                variant="outline"
                icon={Plus}
                onClick={() => console.log('Add feature')}
              >
                Lägg till
              </Button>
            </div>
          </Card>

          <ComponentList
            components={components}
            rooms={[room.name]}
            onAddComponent={handleAddComponent}
            onEditComponent={handleEditComponent}
            onViewComponent={handleViewComponent}
          />

          {issues.length > 0 && <ActiveIssues issues={issues} />}
        </div>

        <div className="space-y-6">
          <Card title="Åtgärder" icon={Wrench}>
            <div className="space-y-3">
              <Button
                variant="primary"
                icon={Plus}
                className="w-full"
                onClick={() => console.log('Add issue')}
              >
                Registrera ärende
              </Button>
              <Button
                variant="secondary"
                icon={Wrench}
                className="w-full"
                onClick={() => console.log('Plan maintenance')}
              >
                Planera underhåll
              </Button>
              <Button
                variant="secondary"
                icon={Settings}
                className="w-full"
                onClick={() => console.log('Room settings')}
              >
                Ruminställningar
              </Button>
            </div>
          </Card>

          <Card title="Status" icon={AlertCircle}>
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
                  <span className="text-sm text-gray-500">Nästa underhåll</span>
                  <span className="text-sm font-medium">2024-06-01</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  )
}
