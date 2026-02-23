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
import { SelectableInvoiceArticles } from '@/data/articles/MiscellaneousInvoiceArticles'
import { InvoiceRow } from '../types'

interface ArticleSectionProps {
  invoiceRows: InvoiceRow[]
  administrativaKostnader: boolean
  hanteringsavgift: boolean
  onInvoiceRowsChange: (rows: InvoiceRow[]) => void
  onAdministrativaKostnaderChange: (checked: boolean) => void
  onHanteringsavgiftChange: (checked: boolean) => void
  errors?: {
    articles?: string
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
  const handleChangeRowPrice = (index: number, value: string | number) => {
    const newRows = [...invoiceRows]
    newRows[index] = { ...newRows[index], price: Number(value) || 0 }
    onInvoiceRowsChange(newRows)
  }

  const handleChangeRowText = (index: number, value: string) => {
    const newRows = [...invoiceRows]
    newRows[index] = { ...newRows[index], text: value }
    onInvoiceRowsChange(newRows)
  }

  const handleChangeRowArticle = (index: number, articleId: string) => {
    const newRows = [...invoiceRows]
    const article = SelectableInvoiceArticles.find((a) => a.id === articleId)
    if (!article) {
      return
    }

    newRows[index].articleId = articleId
    newRows[index].articleName = article.name
    newRows[index].price = article.standardPrice
    onInvoiceRowsChange(newRows)
  }

  const handleAddRow = () => {
    onInvoiceRowsChange([
      ...invoiceRows,
      { price: 0, articleId: '', articleName: '' },
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
        {invoiceRows.map((row, index) => (
          <div
            key={index}
            className="space-y-2 sm:space-y-0 sm:grid grid-rows-2 gap-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="artikel">Artikel</Label>
                <Select
                  onValueChange={(articleId) =>
                    handleChangeRowArticle(index, articleId)
                  }
                >
                  <SelectTrigger
                    id="artikel"
                    className={cn(errors?.articles && 'border-destructive')}
                  >
                    <SelectValue placeholder="Välj artikel" />
                  </SelectTrigger>
                  <SelectContent>
                    {SelectableInvoiceArticles.map((article) => (
                      <SelectItem key={article.id} value={article.id}>
                        {article.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors?.articles && (
                  <p className="text-sm text-destructive">{errors.articles}</p>
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
            <div className="grid grid-cols-3 items-center gap-2">
              <div className="space-y-1 sm:space-y-0">
                <Label>Text</Label>
                <Input
                  value={row.text}
                  onChange={(e) => handleChangeRowText(index, e.target.value)}
                  placeholder="Beskrivning..."
                />
              </div>
              <div className="space-y-1 sm:space-y-0">
                <Label>Pris (ink. moms)</Label>
                <Input
                  type="number"
                  value={row.price}
                  min={0}
                  onChange={(e) => handleChangeRowPrice(index, e.target.value)}
                />
              </div>
              {invoiceRows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleRemoveRow(index)}
                >
                  <X />
                  Ta bort rad
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
