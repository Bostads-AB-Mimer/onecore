import { motion } from 'framer-motion'
import { ArrowRight, type LucideIcon } from 'lucide-react'

interface SearchResultItemProps {
  icon: LucideIcon
  label: string
  prefix?: string
  subtitle?: string | null
  isSelected: boolean
  onClick: () => void
}

export function SearchResultItem({
  icon: Icon,
  label,
  prefix,
  subtitle,
  isSelected,
  onClick,
}: SearchResultItemProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
      onClick={onClick}
    >
      <div className="flex gap-x-1 items-center">
        <Icon className="h-4 w-4" />
        {prefix && prefix}
      </div>
      {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
      <span className="flex-1 text-left">{label}</span>
      <ArrowRight className="h-4 w-4 opacity-50" />
    </motion.button>
  )
}
