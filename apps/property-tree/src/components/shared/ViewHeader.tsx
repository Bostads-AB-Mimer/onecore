import React from 'react'
import { LucideProps } from 'lucide-react'

interface ViewHeaderProps {
  title: string
  subtitle: string
  type: string
  icon: React.ComponentType<LucideProps>
}

export function ViewHeader({
  title,
  subtitle,
  type,
  icon: Icon,
}: ViewHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-700 to-gray-800 dark:from-white dark:via-gray-200 dark:to-gray-300 bg-clip-text text-transparent">
        {title}
      </h1>
      <div className="flex items-center space-x-4 mt-2 text-gray-500">
        <div className="flex items-center">
          <Icon className="h-4 w-4 mr-2" />
          <span>{type}</span>
        </div>
        <span>•</span>
        <span>{subtitle}</span>
      </div>
    </div>
  )
}
