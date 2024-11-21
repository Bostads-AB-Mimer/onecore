import React from 'react'

interface GridProps {
  children: React.ReactNode
  cols?: number
  gap?: number
  className?: string
}

export function Grid({
  children,
  cols = 1,
  gap = 6,
  className = '',
}: GridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid ${gridCols[cols]} gap-${gap} ${className}`}>
      {children}
    </div>
  )
}
