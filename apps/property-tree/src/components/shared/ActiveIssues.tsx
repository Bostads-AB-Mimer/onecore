import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { Issue } from '../../services/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface ActiveIssuesProps {
  issues: Issue[]
}

const priorityLabels = {
  low: 'Låg',
  medium: 'Medium',
  high: 'Hög',
}

const statusLabels = {
  pending: 'Väntar',
  'in-progress': 'Pågående',
  resolved: 'Åtgärdat',
}

export function ActiveIssues({ issues }: ActiveIssuesProps) {
  if (!issues.length) return null

  return (
    <Card title="Pågående ärenden" icon={AlertCircle}>
      <div className="space-y-4">
        {issues.map((issue) => (
          <motion.div
            key={issue.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  {/* TODO: Map priority to badge variant */}
                  <Badge variant={issue.priority as any}>
                    {priorityLabels[issue.priority]}
                  </Badge>
                  <Badge>{statusLabels[issue.status]}</Badge>
                </div>
                <p className="font-medium group-hover:text-blue-500 transition-colors">
                  {issue.description}
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <span>{issue.room}</span>
                  <span className="mx-2">•</span>
                  <span>{issue.feature}</span>
                  <span className="mx-2">•</span>
                  <span>{issue.date}</span>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}
