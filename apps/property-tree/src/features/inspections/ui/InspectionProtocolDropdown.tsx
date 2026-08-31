import { Download, FileText, Mail } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu'

interface InspectionProtocolDropdownProps {
  onDownloadPdf: () => void
  onDownloadPdfWithoutCosts: () => void
  onSendToNewTenant: () => void
  onSendToTenant: () => void
  isDownloading: boolean
  isSending: boolean
  hasNewTenantContacts: boolean
  hasTenantContacts: boolean
  isFetchingContacts: boolean
}

export function InspectionProtocolDropdown({
  onDownloadPdf,
  onDownloadPdfWithoutCosts,
  onSendToNewTenant,
  onSendToTenant,
  isDownloading,
  isSending,
  hasNewTenantContacts,
  hasTenantContacts,
  isFetchingContacts,
}: InspectionProtocolDropdownProps) {
  const isDisabled = isDownloading || isSending || isFetchingContacts

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDisabled}>
          <FileText className="h-4 w-4 mr-2" />
          Protokoll
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={onDownloadPdf}
          disabled={isDownloading}
          className="cursor-pointer"
        >
          <Download className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span> {isDownloading ? 'Genererar PDF…' : 'Ladda ner PDF'}</span>
            <span className="text-xs opacity-70">Med kostnader</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onDownloadPdfWithoutCosts}
          disabled={isDownloading}
          className="cursor-pointer"
        >
          <Download className="h-4 w-4 mr-2" />

          <div className="flex flex-col">
            <span> {isDownloading ? 'Genererar PDF…' : 'Ladda ner PDF'}</span>
            <span className="text-xs opacity-70">Utan kostnader</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onSendToNewTenant}
          disabled={isSending || !hasNewTenantContacts}
          className="cursor-pointer"
        >
          <Mail className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span>Skicka till ny hyresgäst</span>
            <span className="text-xs opacity-70">Inflyttande</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onSendToTenant}
          disabled={isSending || !hasTenantContacts}
          className="cursor-pointer"
        >
          <Mail className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span>Skicka till hyresgäst</span>
            <span className="text-xs opacity-70">Avflyttande</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
