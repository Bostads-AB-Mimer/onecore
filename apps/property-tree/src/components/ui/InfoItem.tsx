import { LucideIcon } from 'lucide-react'

interface InfoItemProps {
  icon: LucideIcon
  label: string
  value: string | number
  onClick?: () => void
}

export function InfoItem({ icon: Icon, label, value, onClick }: InfoItemProps) {
  return (
    <div
      className={`
        flex items-center space-x-3 
        ${onClick ? 'group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-lg transition-all duration-300' : ''}
      `}
      onClick={onClick}
    >
      <Icon
        className={`h-4 w-4 text-gray-400 ${onClick ? 'group-hover:text-blue-500 transition-colors' : ''}`}
      />
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p
          className={`font-medium ${onClick ? 'group-hover:text-blue-500 transition-colors' : ''}`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
