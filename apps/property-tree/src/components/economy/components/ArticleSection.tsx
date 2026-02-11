import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Plus, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

import { cn } from '@/lib/utils'
import { MiscellaneousInvoiceArticles } from '@/data/articles/MiscellaneousInvoiceArticles'
import { InvoiceRow } from '../types'

interface ArticleSectionProps {
  invoiceRows: InvoiceRow[]
  administrativaKostnader: boolean
  hanteringsavgift: boolean
  onInvoiceRowsChange: (rows: InvoiceRow[]) => void
  onAdministrativaKostnaderChange: (checked: boolean) => void
  onHanteringsavgiftChange: (checked: boolean) => void
  errors?: {
    artikel?: string
  }
}

export function ArticleSection({
  invoiceRows,
  administrativaKostnader,
  hanteringsavgift,
  onInvoiceRowsChange,
  onAdministrativaKostnaderChange,
  onHanteringsavgiftChange,
  errors,
}: ArticleSectionProps) {
  const handleRowChange = (
    index: number,
    field: keyof InvoiceRow,
    value: string | number
  ) => {
    const newRows = [...invoiceRows]
    if (field === 'text') {
      newRows[index] = { ...newRows[index], text: value as string }
    } else if (field === 'amount') {
      newRows[index] = { ...newRows[index], amount: Number(value) || 1 }
    } else if (field === 'price') {
      newRows[index] = { ...newRows[index], price: Number(value) || 0 }
    } else if (field === 'articleId') {
      newRows[index] = { ...newRows[index], articleId: value as string }
    }

    onInvoiceRowsChange(newRows)
  }

  const handleAddRow = () => {
    onInvoiceRowsChange([
      ...invoiceRows,
      { text: '', amount: 1, price: 0, articleId: '', articleName: '' },
    ])
  }

  const handleRemoveRow = (index: number) => {
    if (invoiceRows.length > 1) {
      onInvoiceRowsChange(invoiceRows.filter((_, i) => i !== index))
    }
  }

  return (
    <div className="space-y-4">
      {/* Fakturarader - grupperat */}
      <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
        <Label>Fakturarader</Label>

        {/* Header row - only visible on larger screens */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_80px_100px_40px] gap-2 text-sm text-muted-foreground">
          <span>Text</span>
          <span>Antal</span>
          <span>Pris (ink. moms)</span>
          <span></span>
        </div>

        {invoiceRows.map((row, index) => (
          <div
            key={index}
            className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_80px_100px_40px] gap-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="artikel">Artikel</Label>
                <Select
                  onValueChange={(e) => handleRowChange(index, 'articleId', e)}
                >
                  <SelectTrigger
                    id="artikel"
                    className={cn(errors?.artikel && 'border-destructive')}
                  >
                    <SelectValue placeholder="Välj artikel" />
                  </SelectTrigger>
                  <SelectContent>
                    {MiscellaneousInvoiceArticles.map((article) => (
                      <SelectItem key={article.id} value={article.id}>
                        {article.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors?.artikel && (
                  <p className="text-sm text-destructive">{errors.artikel}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="artikelnummer">Artikelnummer</Label>
                <Input
                  id="artikelnummer"
                  value={row.articleId}
                  readOnly
                  disabled
                  placeholder="Fylls i automatiskt"
                  className="bg-muted"
                />
              </div>
            </div>
            <div className="space-y-1 sm:space-y-0">
              <Label className="sm:hidden text-xs text-muted-foreground">
                Text
              </Label>
              <Input
                value={row.text}
                onChange={(e) => handleRowChange(index, 'text', e.target.value)}
                placeholder="Beskrivning..."
              />
            </div>
            <div className="space-y-1 sm:space-y-0">
              <Label className="sm:hidden text-xs text-muted-foreground">
                Antal
              </Label>
              <Input
                type="number"
                min={1}
                value={row.amount}
                onChange={(e) =>
                  handleRowChange(index, 'amount', e.target.value)
                }
              />
            </div>
            <div className="space-y-1 sm:space-y-0">
              <Label className="sm:hidden text-xs text-muted-foreground">
                Pris (ink. moms)
              </Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={row.price}
                onChange={(e) =>
                  handleRowChange(index, 'amount', e.target.value)
                }
              />
            </div>
            <div className="flex items-end sm:items-center justify-end sm:justify-center">
              {invoiceRows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveRow(index)}
                  className="shrink-0 h-9 w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRow}
        >
          <Plus className="h-4 w-4 mr-1" />
          Lägg till rad
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="administrativaKostnader"
            checked={administrativaKostnader}
            onCheckedChange={onAdministrativaKostnaderChange}
            className="rounded-[2px]"
          />
          <Label
            htmlFor="administrativaKostnader"
            className="text-sm font-normal cursor-pointer"
          >
            Administrativa kostnader
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="hanteringsavgift"
            checked={hanteringsavgift}
            onCheckedChange={onHanteringsavgiftChange}
            className="rounded-[2px]"
          />
          <Label
            htmlFor="hanteringsavgift"
            className="text-sm font-normal cursor-pointer"
          >
            Hanteringsavgift
          </Label>
        </div>
      </div>
    </div>
  )
}
