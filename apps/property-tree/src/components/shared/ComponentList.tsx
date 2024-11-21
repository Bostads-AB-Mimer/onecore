import React from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Building,
  Package,
  Wrench,
  Plus,
  ArrowRight,
} from 'lucide-react'
import { Component } from '../../services/types'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ComponentModal } from './ComponentModal'

interface ComponentListProps {
  components: Component[]
  rooms: string[]
  onAddComponent: (data: any) => Promise<void>
  onEditComponent: (id: string, data: any) => Promise<void>
  onViewComponent: (component: Component) => void
}

const typeIcons = {
  appliance: Settings,
  fixture: Building,
  furniture: Package,
  other: Wrench,
}

const statusColors = {
  operational: 'text-green-500',
  'needs-service': 'text-yellow-500',
  broken: 'text-red-500',
}

export function ComponentList({
  components,
  rooms,
  onAddComponent,
  onEditComponent,
  onViewComponent,
}: ComponentListProps) {
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingComponent, setEditingComponent] =
    React.useState<Component | null>(null)

  const handleAddSubmit = async (data: any) => {
    await onAddComponent(data)
    setShowAddModal(false)
  }

  const handleEditSubmit = async (data: any) => {
    if (editingComponent) {
      await onEditComponent(editingComponent.id, data)
      setEditingComponent(null)
    }
  }

  return (
    <>
      <Card title="Komponenter">
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setShowAddModal(true)}
            >
              Lägg till komponent
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {components.map((component) => {
              const Icon = typeIcons[component.type]
              return (
                <motion.div
                  key={component.id}
                  whileHover={{ scale: 1.02 }}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
                  onClick={() => onViewComponent(component)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
                        <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div>
                        <h3 className="font-medium group-hover:text-blue-500 transition-colors">
                          {component.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {component.room}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-sm ${statusColors[component.status]}`}
                      >
                        {component.status === 'operational' && 'OK'}
                        {component.status === 'needs-service' && 'Service'}
                        {component.status === 'broken' && 'Trasig'}
                      </span>
                      <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </Card>

      <ComponentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddSubmit}
        rooms={rooms}
      />

      {editingComponent && (
        <ComponentModal
          isOpen={true}
          onClose={() => setEditingComponent(null)}
          onSubmit={handleEditSubmit}
          rooms={rooms}
          initialData={editingComponent}
        />
      )}
    </>
  )
}
