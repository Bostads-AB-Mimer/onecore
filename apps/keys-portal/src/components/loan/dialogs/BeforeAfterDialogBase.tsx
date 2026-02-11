import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import type { Key } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  selectedKeys?: Key[] // Optional - if not provided, use leftContent
  leftTitle: string
  rightTitle: string
  leftContent?: ReactNode // Optional custom left content
  rightContent: ReactNode
  isProcessing: boolean
  onAccept: () => void
  acceptButtonText: string
  totalCount: number
}

export function BeforeAfterDialogBase({
  open,
  onOpenChange,
  title,
  description,
  selectedKeys,
  leftTitle,
  rightTitle,
  leftContent,
  rightContent,
  isProcessing,
  onAccept,
  acceptButtonText,
  totalCount,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left side - Selected keys or custom content */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
              {leftTitle}
            </h3>
            {leftContent ? (
              leftContent
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {selectedKeys?.map((key) => (
                  <div
                    key={key.id}
                    className="p-3 border rounded-lg bg-muted/50 text-sm"
                  >
                    <div className="font-medium">{key.keyName}</div>
                    <div className="text-muted-foreground">
                      {KeyTypeLabels[key.keyType]}
                      {key.flexNumber !== undefined &&
                        ` • Flex: ${key.flexNumber}`}
                      {key.keySequenceNumber !== undefined &&
                        ` • Sekv: ${key.keySequenceNumber}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right side - Custom content */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
              {rightTitle}
            </h3>
            {rightContent}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Avbryt
          </Button>
          <Button
            onClick={onAccept}
            disabled={isProcessing || totalCount === 0}
          >
            {isProcessing ? (
              <>
                <Spinner size="sm" />
                {acceptButtonText}...
              </>
            ) : (
              `Godkänn (${totalCount})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
