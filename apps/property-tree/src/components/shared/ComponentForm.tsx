import React from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  Package,
  Wrench,
  Loader2,
  Building,
  Tag,
  FileText,
  Settings,
  Hash,
} from 'lucide-react'
import { Button } from '../ui/button'

interface ComponentFormData {
  name: string
  type: 'appliance' | 'fixture' | 'furniture' | 'other'
  category: string
  installationDate: string
  warranty?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  room: string
}

interface ComponentFormProps {
  onSubmit: (data: ComponentFormData) => Promise<void>
  onCancel: () => void
  rooms: string[]
  initialData?: Partial<ComponentFormData>
}

export function ComponentForm({
  onSubmit,
  onCancel,
  rooms,
  initialData,
}: ComponentFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formData, setFormData] = React.useState<ComponentFormData>({
    name: initialData?.name || '',
    type: initialData?.type || 'appliance',
    category: initialData?.category || '',
    installationDate:
      initialData?.installationDate || new Date().toISOString().split('T')[0],
    warranty: initialData?.warranty || '',
    manufacturer: initialData?.manufacturer || '',
    model: initialData?.model || '',
    serialNumber: initialData?.serialNumber || '',
    room: initialData?.room || rooms[0],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  const componentTypes = [
    { value: 'appliance', label: 'Vitvaror', icon: Settings },
    { value: 'fixture', label: 'Fast inredning', icon: Building },
    { value: 'furniture', label: 'Möbler', icon: Package },
    { value: 'other', label: 'Övrigt', icon: Wrench },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Namn
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              required
            />
          </div>
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Kategori
            </label>
            <input
              type="text"
              id="category"
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, category: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              required
            />
          </div>
        </div>

        {/* Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Typ
          </label>
          <div className="grid grid-cols-4 gap-3">
            {componentTypes.map((type) => (
              <motion.button
                key={type.value}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, type: type.value as any }))
                }
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
                  flex flex-col items-center justify-center space-y-2
                  ${
                    formData.type === type.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <type.icon className="h-5 w-5" />
                <span>{type.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Room Selection */}
        <div>
          <label
            htmlFor="room"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Rum
          </label>
          <select
            id="room"
            value={formData.room}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, room: e.target.value }))
            }
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            required
          >
            {rooms.map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="installationDate"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Installationsdatum
            </label>
            <input
              type="date"
              id="installationDate"
              value={formData.installationDate}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  installationDate: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              required
            />
          </div>
          <div>
            <label
              htmlFor="warranty"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Garanti t.o.m.
            </label>
            <input
              type="date"
              id="warranty"
              value={formData.warranty || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, warranty: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>
        </div>

        {/* Additional Details */}
        {formData.type === 'appliance' && (
          <div className="space-y-4 pt-4 border-t dark:border-gray-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="manufacturer"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Tillverkare
                </label>
                <input
                  type="text"
                  id="manufacturer"
                  value={formData.manufacturer || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      manufacturer: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                />
              </div>
              <div>
                <label
                  htmlFor="model"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Modell
                </label>
                <input
                  type="text"
                  id="model"
                  value={formData.model || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, model: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="serialNumber"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Serienummer
              </label>
              <input
                type="text"
                id="serialNumber"
                value={formData.serialNumber || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    serialNumber: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Avbryt
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Sparar...</span>
            </>
          ) : (
            <span>Spara komponent</span>
          )}
        </Button>
      </div>
    </form>
  )
}
