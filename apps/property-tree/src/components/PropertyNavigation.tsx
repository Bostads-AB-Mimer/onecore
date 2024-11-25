import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  ChevronRight,
  MapPin,
  Home,
  Layers,
  Building,
  DoorClosed,
  Loader2,
} from 'lucide-react'
import clsx from 'clsx'
import { NavigationItem } from '../services/types'
import { propertyService } from '../services/api/propertyService'

const iconMap = {
  area: MapPin,
  property: Building2,
  building: Building,
  entrance: Layers,
  apartment: Home,
  default: DoorClosed,
}

const routeMap = {
  area: '/areas',
  property: '/properties',
  building: '/buildings',
  entrance: '/entrances',
  apartment: '/apartments',
  tenant: '/tenants',
}

interface NavigationItemProps {
  item: NavigationItem
  level: number
  expanded: Record<string, boolean>
  selected: string | null
  onToggle: (id: string) => void
  onSelect: (item: NavigationItem) => void
}

const NavigationItemComponent: React.FC<NavigationItemProps> = ({
  item,
  level,
  expanded,
  selected,
  onToggle,
  onSelect,
}) => {
  const Icon = iconMap[item.type] || iconMap.default
  const hasChildren = item.children && item.children.length > 0
  const hasSingleChild = hasChildren && item.children?.length === 1
  const isExpanded = expanded[item.id] || hasSingleChild
  const isSelected = selected === item.id
  const navigate = useNavigate()

  // Auto-expand if this is the only child at this level
  React.useEffect(() => {
    if (hasSingleChild) {
      onToggle(item.id)
    }
  }, [])

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (hasChildren && !hasSingleChild) {
      onToggle(item.id)
    }
    onSelect(item)

    const basePath = routeMap[item.type]
    if (basePath) {
      navigate(`${basePath}/${item.id}`)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.button
        onClick={handleClick}
        className={clsx(
          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300',
          'hover:bg-gray-50 dark:hover:bg-gray-800',
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            : 'text-gray-600 dark:text-gray-400',
          'group relative'
        )}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center space-x-2 flex-1">
          <Icon
            className={clsx(
              'h-4 w-4 transition-colors duration-300',
              isSelected
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
            )}
          />
          <span className="truncate">{item.name}</span>
        </div>
        {hasChildren && !hasSingleChild && (
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.div>
        )}

        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-50/0 to-blue-50/0 dark:via-blue-900/0 dark:to-blue-900/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          layoutId={`hover-${item.id}`}
        />
      </motion.button>

      <AnimatePresence>
        {isExpanded && item.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {item.children.map((child) => (
              <NavigationItemComponent
                key={child.id}
                item={child}
                level={level + 1}
                expanded={expanded}
                selected={selected}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function PropertyNavigation() {
  const [navigationItems, setNavigationItems] = React.useState<
    NavigationItem[]
  >([])
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [selected, setSelected] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const loadAreas = async () => {
      try {
        const areas = await propertyService.getAreas()
        const navigationItems = await Promise.all(
          areas.map(async (area) => {
            const properties = await propertyService.getAll()
            const areaProperties = properties.filter(property => 
              property.tract === area.id
            )
            
            return {
              id: area.id,
              name: area.name,
              type: 'area',
              children: areaProperties.map(property => ({
                id: property.id,
                name: property.name,
                type: 'property',
                children: [], // We'll add buildings when that API is available
              }))
            }
          })
        )
        
        setNavigationItems(navigationItems)

        // Auto-expand root level if there's only one area
        if (navigationItems.length === 1) {
          setExpanded((prev) => ({
            ...prev,
            [navigationItems[0].id]: true,
          }))
        }
      } catch (err) {
        setError('Failed to load properties')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadProperties()
  }, [])

  const handleToggle = (id: string) => {
    // Only allow toggle if the item has more than one child
    const findItem = (items: NavigationItem[]): NavigationItem | null => {
      for (const item of items) {
        if (item.id === id) return item
        if (item.children) {
          const found = findItem(item.children)
          if (found) return found
        }
      }
      return null
    }

    const item = findItem(navigationItems)
    if (item && (!item.children || item.children.length > 1)) {
      setExpanded((prev) => ({
        ...prev,
        [id]: !prev[id],
      }))
    }
  }

  const handleSelect = (item: NavigationItem) => {
    setSelected(item.id)

    if (item.type === 'apartment') {
      let path = []

      const findPath = (items: NavigationItem[], target: string): boolean => {
        for (const item of items) {
          if (item.id === target) {
            path.push(item.id)
            return true
          }
          if (item.children && findPath(item.children, target)) {
            path.push(item.id)
            return true
          }
        }
        return false
      }

      findPath(navigationItems, item.id)

      setExpanded((prev) => {
        const newExpanded = { ...prev }
        path.forEach((id) => {
          newExpanded[id] = true
        })
        return newExpanded
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="h-6 w-6 text-blue-500" />
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 text-center">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-2">
          Navigation
        </h2>
        <div className="h-px bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800" />
      </div>

      <motion.div
        className="space-y-0.5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {navigationItems.map((item) => (
          <NavigationItemComponent
            key={item.id}
            item={item}
            level={0}
            expanded={expanded}
            selected={selected}
            onToggle={handleToggle}
            onSelect={handleSelect}
          />
        ))}
      </motion.div>
    </div>
  )
}
