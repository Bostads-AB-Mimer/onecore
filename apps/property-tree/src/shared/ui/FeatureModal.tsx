import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, History, Wrench, AlertCircle } from 'lucide-react'
import { IssueForm, IssueFormData } from './IssueForm'

interface FeatureDetails {
  name: string
  installationDate: string
  warranty: string
  lastService?: string
  nextService?: string
  issues?: {
    date: string
    description: string
    status: 'resolved' | 'pending' | 'in-progress'
  }[]
}

interface FeatureModalProps {
  isOpen: boolean
  onClose: () => void
  feature: FeatureDetails
}

export function FeatureModal({ isOpen, onClose, feature }: FeatureModalProps) {
  const [showIssueForm, setShowIssueForm] = React.useState(false)
  const statusColors = {
    resolved: 'text-green-500',
    pending: 'text-yellow-500',
    'in-progress': 'text-blue-500',
  }

  const handleSubmitIssue = async (data: IssueFormData) => {
    // In a real application, this would send the data to an API
    console.log('Submitting issue:', data)
    await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call
    setShowIssueForm(false)
    onClose()
  }

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl mx-4"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
              <h2 className="text-xl font-semibold">{feature.name}</h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {showIssueForm ? (
                <IssueForm
                  featureName={feature.name}
                  onSubmit={handleSubmitIssue}
                  onCancel={() => setShowIssueForm(false)}
                />
              ) : (
                <>
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-gray-500">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span className="text-sm">Installerad</span>
                      </div>
                      <p className="font-medium">{feature.installationDate}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center text-gray-500">
                        <History className="h-4 w-4 mr-2" />
                        <span className="text-sm">Garanti</span>
                      </div>
                      <p className="font-medium">{feature.warranty}</p>
                    </div>
                  </div>

                  {/* Service Info */}
                  {(feature.lastService || feature.nextService) && (
                    <div className="pt-4 border-t dark:border-gray-700">
                      <h3 className="text-sm font-medium mb-3 flex items-center">
                        <Wrench className="h-4 w-4 mr-2" />
                        Service
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {feature.lastService && (
                          <div>
                            <p className="text-sm text-gray-500">
                              Senaste service
                            </p>
                            <p className="font-medium">{feature.lastService}</p>
                          </div>
                        )}
                        {feature.nextService && (
                          <div>
                            <p className="text-sm text-gray-500">
                              Nästa service
                            </p>
                            <p className="font-medium">{feature.nextService}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Issues */}
                  {feature.issues && feature.issues.length > 0 && (
                    <div className="pt-4 border-t dark:border-gray-700">
                      <h3 className="text-sm font-medium mb-3 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Ärenden
                      </h3>
                      <div className="space-y-3">
                        {feature.issues.map((issue, index) => (
                          <div
                            key={index}
                            className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">
                                {issue.date}
                              </span>
                              <span
                                className={`text-sm font-medium ${statusColors[issue.status]}`}
                              >
                                {issue.status === 'resolved' && 'Åtgärdat'}
                                {issue.status === 'pending' && 'Väntar'}
                                {issue.status === 'in-progress' && 'Pågående'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {issue.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!showIssueForm && (
              <div className="sticky bottom-0 p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex justify-end space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm font-medium"
                  >
                    Stäng
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowIssueForm(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
                  >
                    Registrera ärende
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
