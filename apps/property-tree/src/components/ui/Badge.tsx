import React from 'react'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

interface BadgeProps {
  children: React.ReactNode
  icon?: LucideIcon
  variant?: 'default' | 'success' | 'warning' | 'error'
  onClick?: () => void
}

export function Badge({
  children,
  icon: Icon,
  variant = 'default',
  onClick,
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    success:
      'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    warning:
      'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    error: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  }

  const Component = onClick ? motion.button : 'div'
  const motionProps = onClick
    ? {
        whileHover: { scale: 1.05 },
        whileTap: { scale: 0.95 },
      }
    : {}

  return (
    <Component
      {...motionProps}
      onClick={onClick}
      className={`
        inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs
        ${variantStyles[variant]}
        ${onClick ? 'cursor-pointer hover:bg-opacity-80' : ''}
      `}
    >
      {Icon && <Icon className="h-3 w-3" />}
      <span>{children}</span>
    </Component>
  )
}
