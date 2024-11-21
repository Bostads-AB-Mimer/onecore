import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Command,
  Search,
  Building2,
  MapPin,
  Home,
  ArrowRight,
  User2,
} from 'lucide-react'
import { NavigationItem } from '../services/types'
import { propertyService } from '../services/propertyService'
import { useCommandPalette } from '../hooks/useCommandPalette'

const routeMap = {
  area: '/areas',
  property: '/properties',
  building: '/buildings',
  entrance: '/entrances',
  apartment: '/apartments',
  tenant: '/tenants',
}

const iconMap = {
  area: MapPin,
  property: Building2,
  building: Building2,
  entrance: Home,
  apartment: Home,
  tenant: User2,
}

export function CommandPalette() {
  const navigate = useNavigate()
  const { isOpen, close } = useCommandPalette()
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<NavigationItem[]>([])
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const search = async () => {
      if (query.trim()) {
        const searchResults = await propertyService.searchProperties(query)
        setResults(searchResults)
        setSelectedIndex(0)
      } else {
        setResults([])
      }
    }
    search()
  }, [query])

  React.useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => (i < results.length - 1 ? i + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => (i > 0 ? i - 1 : results.length - 1))
        break
      case 'Enter':
        if (results[selectedIndex]) {
          const item = results[selectedIndex]
          const basePath = routeMap[item.type]
          if (basePath) {
            navigate(`${basePath}/${item.id}`)
            close()
          }
        }
        break
      case 'Escape':
        close()
        break
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50"
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
          >
            <div className="p-4 border-b dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <Command className="h-5 w-5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Sök efter fastigheter, lägenheter eller hyresgäster..."
                  className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {results.length > 0 ? (
                <div className="p-2">
                  {results.map((item, index) => {
                    const Icon = iconMap[item.type] || Home
                    return (
                      <motion.button
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`
                          w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm
                          ${
                            selectedIndex === index
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }
                        `}
                        onClick={() => {
                          const basePath = routeMap[item.type]
                          if (basePath) {
                            navigate(`${basePath}/${item.id}`)
                            close()
                          }
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1 text-left">{item.name}</span>
                        <ArrowRight className="h-4 w-4 opacity-50" />
                      </motion.button>
                    )
                  })}
                </div>
              ) : query ? (
                <div className="p-4 text-center text-gray-500">
                  Inga resultat hittades
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  Börja skriva för att söka...
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
