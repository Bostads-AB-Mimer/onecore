import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import { useComponentEntityMutation } from '@/entities/component'
import type { ComponentModel } from '@/services/types'

interface CreateInstanceDialogProps {
  isOpen: boolean
  onClose: () => void
  model: ComponentModel
}

export const CreateInstanceDialog = ({
  isOpen,
  onClose,
  model,
}: CreateInstanceDialogProps) => {
  const createMutation = useComponentEntityMutation(
    'instance',
    'create',
    'modelId'
  )

  const [formData, setFormData] = useState({
    serialNumber: '',
    warrantyStartDate: '',
    warrantyMonths: 0,
    priceAtPurchase: 0,
    depreciationPriceAtPurchase: 0,
    economicLifespan: 0,
    status: 'ACTIVE' as
      | 'ACTIVE'
      | 'INACTIVE'
      | 'MAINTENANCE'
      | 'DECOMMISSIONED',
    quantity: 1,
    ncsCode: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when dialog opens and pre-fill from model/subtype
  useEffect(() => {
    if (isOpen) {
      setFormData({
        serialNumber: '',
        warrantyStartDate: '',
        warrantyMonths: model.warrantyMonths || 0,
        priceAtPurchase: model.currentPrice || 0,
        depreciationPriceAtPurchase: model.subtype?.depreciationPrice || 0,
        economicLifespan: model.subtype?.economicLifespan || 0,
        status: 'ACTIVE',
        quantity: 1,
        ncsCode: '',
      })
      setErrors({})
    }
  }, [isOpen, model])

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await createMutation.mutateAsync({
        modelId: model.id,
        serialNumber: formData.serialNumber,
        warrantyStartDate: formData.warrantyStartDate || undefined,
        warrantyMonths: formData.warrantyMonths,
        priceAtPurchase: formData.priceAtPurchase,
        depreciationPriceAtPurchase: formData.depreciationPriceAtPurchase,
        economicLifespan: formData.economicLifespan,
        status: formData.status,
        quantity: formData.quantity,
        ncsCode: formData.ncsCode || undefined,
      } as any)
      onClose()
    } catch (error: any) {
      // Backend validation errors
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors)
      }
      console.error('Failed to create instance:', error)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa komponent</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Modell: {model.manufacturer} {model.modelName}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Instance Details */}
          <div className="space-y-4">
            <h3 className="font-medium">Komponentinformation</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="serialNumber">Serienummer *</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => handleChange('serialNumber', e.target.value)}
                  placeholder="SN-12345"
                />
                {errors.serialNumber && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.serialNumber}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">Aktiv</option>
                  <option value="INACTIVE">Inaktiv</option>
                  <option value="MAINTENANCE">Underhåll</option>
                  <option value="DECOMMISSIONED">Ur drift</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Antal</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) =>
                    handleChange('quantity', parseInt(e.target.value) || 0)
                  }
                />
                {errors.quantity && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.quantity}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="ncsCode">NCS-kod (valfritt)</Label>
                <Input
                  id="ncsCode"
                  value={formData.ncsCode}
                  onChange={(e) => handleChange('ncsCode', e.target.value)}
                  placeholder="123 eller 123.456"
                />
                {errors.ncsCode && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.ncsCode}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Warranty Information */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium">Garantiinformation</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="warrantyStartDate">
                  Garantistartdatum (valfritt)
                </Label>
                <Input
                  id="warrantyStartDate"
                  type="date"
                  value={formData.warrantyStartDate}
                  onChange={(e) =>
                    handleChange('warrantyStartDate', e.target.value)
                  }
                />
              </div>

              <div>
                <Label htmlFor="warrantyMonths">Garanti (månader) *</Label>
                <Input
                  id="warrantyMonths"
                  type="number"
                  min="0"
                  value={formData.warrantyMonths}
                  onChange={(e) =>
                    handleChange(
                      'warrantyMonths',
                      parseInt(e.target.value) || 0
                    )
                  }
                />
                {errors.warrantyMonths && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.warrantyMonths}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Pricing Information */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium">Prisinformation</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priceAtPurchase">Inköpspris (kr) *</Label>
                <Input
                  id="priceAtPurchase"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.priceAtPurchase}
                  onChange={(e) =>
                    handleChange(
                      'priceAtPurchase',
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
                {errors.priceAtPurchase && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.priceAtPurchase}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="depreciationPriceAtPurchase">
                  Avskrivningspris (kr) *
                </Label>
                <Input
                  id="depreciationPriceAtPurchase"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.depreciationPriceAtPurchase}
                  onChange={(e) =>
                    handleChange(
                      'depreciationPriceAtPurchase',
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder={
                    model.subtype?.depreciationPrice
                      ? `Standard: ${model.subtype.depreciationPrice} kr`
                      : undefined
                  }
                />
                {errors.depreciationPriceAtPurchase && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.depreciationPriceAtPurchase}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="economicLifespan">
                Ekonomisk livslängd (år) *
              </Label>
              <Input
                id="economicLifespan"
                type="number"
                min="0"
                value={formData.economicLifespan}
                onChange={(e) =>
                  handleChange(
                    'economicLifespan',
                    parseInt(e.target.value) || 0
                  )
                }
                placeholder={
                  model.subtype?.economicLifespan
                    ? `Standard: ${model.subtype.economicLifespan} år`
                    : undefined
                }
              />
              {errors.economicLifespan && (
                <p className="text-sm text-destructive mt-1">
                  {errors.economicLifespan}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Skapar...' : 'Skapa komponent'}
            </Button>
          </DialogFooter>

          {createMutation.isError && (
            <p className="text-sm text-destructive text-center">
              Ett fel uppstod vid skapande av komponent. Försök igen.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
