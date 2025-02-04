import React from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  User2,
  Mail,
  Phone,
  Calendar,
  Home,
  FileText,
  MessageSquare,
} from 'lucide-react'
import { ViewHeader } from '../shared/ViewHeader'

export function TenantView() {
  const { tenantId } = useParams()
  const [tenant, setTenant] = React.useState<Tenant | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadTenant = async () => {
      try {
        // In a real application, we would fetch the tenant data here
        // For now, we'll use mock data
        setTenant({
          id: tenantId!,
          name: 'Anna Svensson',
          email: 'anna.svensson@example.com',
          phone: '070-123 45 67',
          moveInDate: '2021-01-01',
          residenceId: '101',
        })
      } finally {
        setLoading(false)
      }
    }
    loadTenant()
  }, [tenantId])

  if (loading) return <div>Loading...</div>
  if (!tenant) return <div>Tenant not found</div>

  return (
    <div className="p-8 animate-in">
      <ViewHeader
        title={tenant.name}
        subtitle={`Lägenhet ${tenant.residenceId}`}
        type="Hyresgäst"
        icon={User2}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Kontaktinformation</h2>
              <User2 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">E-post</p>
                    <p className="font-medium">{tenant.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Telefon</p>
                    <p className="font-medium">{tenant.phone}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Inflyttningsdatum</p>
                    <p className="font-medium">{tenant.moveInDate}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Home className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Lägenhet</p>
                    <p className="font-medium">{tenant.residenceId}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Historik</h2>
              <FileText className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Inga tidigare ärenden registrerade
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Åtgärder</h2>
              <MessageSquare className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-300"
              >
                Skicka meddelande
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-300"
              >
                Visa kontrakt
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-300"
              >
                Registrera ärende
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
