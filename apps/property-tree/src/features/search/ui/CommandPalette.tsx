import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Building as BuildingIcon,
  Building2,
  CarFront,
  Command,
  Loader2,
  SquareUser,
  User2,
  Wrench,
} from 'lucide-react'

import { debounce } from '@/shared/lib/debounce'
import { paths } from '@/shared/routes'

import { useCommandPalette } from '../hooks/useCommandPalette'
import { type CombinedSearchResult, useSearch } from '../hooks/useSearch'
import { SearchResultItem } from '../ui/SearchResultItem'

const iconMap = {
  property: Building2,
  building: BuildingIcon,
  residence: SquareUser,
  contact: User2,
  'parking-space': CarFront,
  'maintenance-unit': Wrench,
} as const

function getResultProps(item: CombinedSearchResult) {
  const icon = iconMap[item.type as keyof typeof iconMap]

  switch (item.type) {
    case 'building':
      return {
        icon,
        label: item.name ?? '-',
        subtitle: item.property?.name,
        path: paths.building(item.code),
        state: { propertyCode: item.property?.code || null },
      }
    case 'property':
      return {
        icon,
        label: item.name,
        path: paths.property(item.code),
        state: {},
      }
    case 'residence':
      return {
        icon,
        label: item.rentalId ?? '[rental id missing]',
        prefix: '[LGH]',
        subtitle: item.building?.name,
        path: paths.residence(item.id),
        state: {
          buildingCode: item.building?.code || null,
          propertyCode: item.property?.code || null,
        },
      }
    case 'contact':
      return {
        icon,
        label: item.contactCode,
        subtitle: item.fullName,
        path: paths.tenant(item.contactCode),
        state: {},
      }
    case 'parking-space':
      return {
        icon,
        label: item.rentalId,
        prefix: '[P]',
        subtitle: item.property?.name,
        path: paths.parkingSpace(item.rentalId),
        state: {
          buildingCode: item.building?.code || null,
          propertyCode: item.property?.code || null,
        },
      }
    case 'maintenance-unit':
      return {
        icon,
        label: item.code,
        prefix: '[UE]',
        subtitle: item.estate,
        path: paths.maintenanceUnit(item.code),
        state: {},
      }
    default:
      return null
  }
}

export function CommandPalette() {
  const navigate = useNavigate()
  const { isOpen, close } = useCommandPalette()
  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const searchQuery = useSearch(query)

  const onSearch = React.useMemo(() => debounce(setQuery, 300), [])

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

  const handleSelect = (item: CombinedSearchResult) => {
    const props = getResultProps(item)
    if (props) {
      navigate(props.path, { state: props.state })
      close()
    }
  }

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
          handleSelect(searchQuery.data[selectedIndex])
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
            className="fixed left-4 right-4 top-[20%] sm:left-[calc(50%-350px)] sm:right-auto sm:w-[700px] border border-gray-200 bg-white dark:bg-gray-800 rounded-xl shadow-2xl dark:border-gray-700 overflow-hidden z-50"
          >
            <div className="p-4 border-b dark:border-gray-700 flex items-center space-x-3">
              <Command className="h-5 w-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                onChange={(e) => onSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Sök efter fastigheter, byggnader, lägenheter, bilplatser eller kunder..."
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
                  Skriv minst 3 tecken för att söka...
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
              {searchQuery.data && searchQuery.data.length > 0 && (
                <div className="p-2">
                  {searchQuery.data.map((item, index) => {
                    const props = getResultProps(item)
                    if (!props) return null
                    return (
                      <SearchResultItem
                        key={'code' in item ? item.code : (item.id ?? index)}
                        icon={props.icon}
                        label={props.label}
                        prefix={props.prefix}
                        subtitle={props.subtitle}
                        isSelected={selectedIndex === index}
                        onClick={() => handleSelect(item)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
