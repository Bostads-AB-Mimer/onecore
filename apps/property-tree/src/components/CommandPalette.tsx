import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Command,
  Building2,
  MapPin,
  Home,
  ArrowRight,
  User2,
  Loader2,
  Building as BuildingIcon,
} from 'lucide-react'
import { match } from 'ts-pattern'

import { useSearch } from './hooks/useSearch'
import { useCommandPalette } from './hooks/useCommandPalette'
import { debounce } from '@/utils/debounce'

const routeMap = {
  property: '/properties',
  building: '/buildings',
  staircase: '/staircases',
  residence: '/residences',
} as const

const iconMap = {
  area: MapPin,
  property: Building2,
  building: BuildingIcon,
  entrance: Home,
  apartment: Home,
  tenant: User2,
} as const

export function CommandPalette() {
  const navigate = useNavigate()
  const { isOpen, close } = useCommandPalette()
  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const searchQuery = useSearch(query)

  const handleSearch = React.useCallback((v: string) => setQuery(v), [])
  const onSearch = debounce(handleSearch, 300)

  React.useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  React.useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      inputRef.current?.focus()
    }
  }, [isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!searchQuery.data) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => (i < searchQuery.data.length - 1 ? i + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => (i > 0 ? i - 1 : searchQuery.data.length - 1))
        break
      case 'Enter':
        if (searchQuery.data[selectedIndex]) {
          const item = searchQuery.data[selectedIndex]
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
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed left-[calc(50%-350px)] top-[20%] w-[700px] border border-gray-200 bg-white dark:bg-gray-800 rounded-xl shadow-2xl dark:border-gray-700 overflow-hidden z-50"
          >
            <div className="p-4 border-b dark:border-gray-700 flex items-center space-x-3">
              <Command className="h-5 w-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                onChange={(e) => onSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Sök efter fastigheter, bostäder eller lägenheter..."
                className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {!query && (
                <div className="p-4 text-center text-gray-500">
                  Börja skriva för att söka...
                </div>
              )}
              {Boolean(query) && query.length < 3 && (
                <div className="p-4 text-center text-gray-500">
                  Inga resultat hittades
                </div>
              )}
              {searchQuery.isFetched && searchQuery.data?.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  Inga resultat hittades
                </div>
              )}
              {searchQuery.isLoading && (
                <div className="p-4 flex justify-center items-center text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              {searchQuery.data?.length && (
                <div className="p-2">
                  {searchQuery.data.map((item, index) =>
                    match(item)
                      .with({ type: 'building' }, (v) => (
                        <Building
                          key={v.id}
                          name={v.name}
                          property={v.property}
                          className={
                            selectedIndex === index
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }
                          onClick={() => {
                            const basePath = routeMap[v.type]
                            if (basePath) {
                              navigate(`${basePath}/${v.id}`)
                              close()
                            }
                          }}
                        />
                      ))
                      .with({ type: 'property' }, (v) => (
                        <Property
                          key={v.id}
                          name={v.name}
                          className={
                            selectedIndex === index
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }
                          onClick={() => {
                            const basePath = routeMap[v.type]
                            if (basePath) {
                              navigate(`${basePath}/${v.id}`)
                              close()
                            }
                          }}
                        />
                      ))
                      .exhaustive()
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Building(props: {
  name: string
  property?: { id: string; name: string | null; code: string } | null
  className?: string
  onClick: () => void
}) {
  const Icon = iconMap.building
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm
        ${props.className}
      `}
      onClick={props.onClick}
    >
      <Icon className="h-4 w-4" />
      {props.property && (
        <span className="text-xs text-gray-400">{props.property.name}</span>
      )}
      <span className="flex-1 text-left">{props.name}</span>
      <ArrowRight className="h-4 w-4 opacity-50" />
    </motion.button>
  )
}

function Property(props: {
  name: string
  className?: string
  onClick: () => void
}) {
  const Icon = iconMap.property
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm
        ${props.className}
      `}
      onClick={props.onClick}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1 text-left">{props.name}</span>
      <ArrowRight className="h-4 w-4 opacity-50" />
    </motion.button>
  )
}
