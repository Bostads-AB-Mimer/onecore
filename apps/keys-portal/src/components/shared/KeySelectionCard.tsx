import { useState } from 'react'
import { KeyAutocomplete } from '@/components/maintenance/KeyAutocomplete'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Key } from '@/services/types'
import type { LucideIcon } from 'lucide-react'

interface KeySelectionCardProps {
  title: string
  buttonText: string
  buttonIcon: LucideIcon
  onValidateKey?: (key: Key) => { valid: boolean; errorMessage?: string }
  onAccept: (selectedKeys: Key[]) => Promise<void>
  disabled?: boolean
}

/**
 * Generic card component for selecting keys
 * Used for both adding keys to bundles and creating maintenance loans
 */
export function KeySelectionCard({
  title,
  buttonText,
  buttonIcon: Icon,
  onValidateKey,
  onAccept,
  disabled = false,
}: KeySelectionCardProps) {
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const handleAddKey = (key: Key) => {
    // Run validation if provided
    if (onValidateKey) {
      const validation = onValidateKey(key)
      if (!validation.valid) {
        // Validation error will be shown via toast by the parent
        return
      }
    }

    setSelectedKeys((prev) => [...prev, key])
  }

  const handleRemoveKey = (keyId: string) => {
    setSelectedKeys((prev) => prev.filter((k) => k.id !== keyId))
  }

  const handleAccept = async () => {
    if (selectedKeys.length === 0) return

    setIsProcessing(true)
    try {
      await onAccept(selectedKeys)
      setSelectedKeys([])
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <KeyAutocomplete
          selectedKeys={selectedKeys}
          onAddKey={handleAddKey}
          onRemoveKey={handleRemoveKey}
          disabled={disabled || isProcessing}
        />

        {selectedKeys.length > 0 && (
          <Button
            onClick={handleAccept}
            disabled={disabled || isProcessing}
            className="w-full"
          >
            <Icon className="h-4 w-4 mr-2" />
            {buttonText.replace(
              '{count}',
              `${selectedKeys.length} nyckel${selectedKeys.length > 1 ? 'ar' : ''}`
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
