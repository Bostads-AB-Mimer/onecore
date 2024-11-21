import React from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Calendar, FileText, Loader2 } from 'lucide-react'

interface IssueFormProps {
  featureName: string
  onSubmit: (data: IssueFormData) => Promise<void>
  onCancel: () => void
}

export interface IssueFormData {
  description: string
  priority: 'low' | 'medium' | 'high'
  category: 'maintenance' | 'repair' | 'replacement'
  desiredDate?: string
}

export function IssueForm({ featureName, onSubmit, onCancel }: IssueFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formData, setFormData] = React.useState<IssueFormData>({
    description: '',
    priority: 'medium',
    category: 'maintenance',
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Description */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Beskrivning
          </label>
          <textarea
            id="description"
            rows={4}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            placeholder={`Beskriv problemet med ${featureName}...`}
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            required
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Prioritet
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'low', label: 'Låg', color: 'bg-green-500' },
              { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
              { value: 'high', label: 'Hög', color: 'bg-red-500' },
            ].map((priority) => (
              <motion.button
                key={priority.value}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: priority.value as any,
                  }))
                }
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
                  ${
                    formData.priority === priority.value
                      ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ' +
                        priority.color
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                {priority.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Kategori
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'maintenance', label: 'Underhåll', icon: FileText },
              { value: 'repair', label: 'Reparation', icon: AlertCircle },
              { value: 'replacement', label: 'Utbyte', icon: Calendar },
            ].map((category) => (
              <motion.button
                key={category.value}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    category: category.value as any,
                  }))
                }
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center space-x-2
                  ${
                    formData.category === category.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <category.icon className="h-4 w-4" />
                <span>{category.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Desired Date */}
        <div>
          <label
            htmlFor="desiredDate"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Önskat datum för åtgärd (valfritt)
          </label>
          <input
            type="date"
            id="desiredDate"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            value={formData.desiredDate || ''}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, desiredDate: e.target.value }))
            }
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm font-medium"
          disabled={isSubmitting}
        >
          Avbryt
        </motion.button>
        <motion.button
          type="submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center space-x-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Skickar...</span>
            </>
          ) : (
            <span>Registrera ärende</span>
          )}
        </motion.button>
      </div>
    </form>
  )
}
