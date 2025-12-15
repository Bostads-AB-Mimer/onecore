import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/v2/Dialog'
import { Button } from '@/components/ui/v2/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/v2/Label'
import { ModelSelector, type ComponentModelWithHierarchy } from './ModelSelector'
import { InstanceSelector } from './InstanceSelector'
import { useInstallComponent } from '@/components/hooks/useInstallComponent'
import { componentService } from '@/services/api/core/componentService'
import { useQueryClient } from '@tanstack/react-query'

interface ComponentInstallationDialogProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  roomName?: string
}

export const ComponentInstallationDialog = ({
  isOpen,
  onClose,
  roomId,
  roomName,
}: ComponentInstallationDialogProps) => {
  const queryClient = useQueryClient()
  const [installationMode, setInstallationMode] = useState<'new' | 'existing'>('new')
  const [selectedModel, setSelectedModel] = useState<ComponentModelWithHierarchy | undefined>()
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('')
  const installMutation = useInstallComponent(roomId)

  const [formData, setFormData] = useState({
    modelId: '',
    serialNumber: '',
    warrantyStartDate: '',
    warrantyMonths: 0,
    priceAtPurchase: 0,
    depreciationPriceAtPurchase: 0,
    economicLifespan: 0,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED',
    quantity: 1,
    ncsCode: '',
    installationDate: new Date().toISOString().split('T')[0],
    installationCost: 0,
    orderNumber: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        modelId: '',
        serialNumber: '',
        warrantyStartDate: '',
        warrantyMonths: 0,
        priceAtPurchase: 0,
        depreciationPriceAtPurchase: 0,
        economicLifespan: 0,
        status: 'ACTIVE',
        quantity: 1,
        ncsCode: '',
        installationDate: new Date().toISOString().split('T')[0],
        installationCost: 0,
        orderNumber: '',
      })
      setErrors({})
      setSelectedModel(undefined)
      setSelectedInstanceId('')
      setInstallationMode('new')
    }
  }, [isOpen])

  // Update form defaults when model is selected
  useEffect(() => {
    if (selectedModel) {
      // Auto-fill from model
      setFormData(prev => ({
        ...prev,
        warrantyMonths: selectedModel.warrantyMonths || 0,
        priceAtPurchase: selectedModel.currentPrice || 0,
        installationCost: selectedModel.currentInstallPrice || 0,
        economicLifespan: selectedModel.subtype?.economicLifespan || 0,
        depreciationPriceAtPurchase: selectedModel.subtype?.depreciationPrice || 0,
      }))
    }
  }, [selectedModel])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (installationMode === 'new') {
        // Create new instance and install
        await installMutation.mutateAsync({
          modelId: formData.modelId,
          serialNumber: formData.serialNumber,
          warrantyStartDate: formData.warrantyStartDate || undefined,
          warrantyMonths: formData.warrantyMonths,
          priceAtPurchase: formData.priceAtPurchase,
          depreciationPriceAtPurchase: formData.depreciationPriceAtPurchase,
          economicLifespan: formData.economicLifespan,
          status: formData.status,
          quantity: formData.quantity,
          ncsCode: formData.ncsCode || undefined,
          installationDate: formData.installationDate,
          installationCost: formData.installationCost,
          orderNumber: formData.orderNumber || undefined,
        })
      } else {
        // Install existing instance
        if (!selectedInstanceId) {
          throw new Error('No instance selected')
        }

        // Always update warranty fields (they're pre-filled from selected instance)
        await componentService.updateInstance(selectedInstanceId, {
          warrantyMonths: formData.warrantyMonths,
          warrantyStartDate: formData.warrantyStartDate || undefined,
        })

        // Then install
        await componentService.installExistingInstance(
          selectedInstanceId,
          roomId,
          {
            installationDate: formData.installationDate,
            installationCost: formData.installationCost,
            orderNumber: formData.orderNumber || undefined,
          }
        )

        // Manually invalidate queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['components', roomId] })
        queryClient.invalidateQueries({ queryKey: ['instances', 'uninstalled'] })
        queryClient.invalidateQueries({ queryKey: ['instances'] })
      }
      onClose()
    } catch (error: any) {
      // Backend validation errors
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors)
      }
      console.error('Failed to install component:', error)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Installera komponent</DialogTitle>
          {roomName && (
            <p className="text-sm text-muted-foreground">Rum: {roomName}</p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mode Toggle */}
          <div className="space-y-2">
            <Label>Installationstyp</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="installationMode"
                  value="new"
                  checked={installationMode === 'new'}
                  onChange={() => {
                    setInstallationMode('new')
                    setSelectedInstanceId('')
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">Ny instans</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="installationMode"
                  value="existing"
                  checked={installationMode === 'existing'}
                  onChange={() => setInstallationMode('existing')}
                  className="w-4 h-4"
                />
                <span className="text-sm">Befintlig instans</span>
              </label>
            </div>
          </div>

          {/* Model Selection */}
          <ModelSelector
            value={formData.modelId}
            onChange={(id, model) => {
              handleChange('modelId', id)
              setSelectedModel(model)
              setSelectedInstanceId('') // Reset instance selection when model changes
            }}
            error={errors.modelId}
          />

          {/* Instance Selection (only in 'existing' mode) */}
          {installationMode === 'existing' && selectedModel && (
            <InstanceSelector
              modelId={selectedModel.id}
              value={selectedInstanceId}
              onChange={(id, instance) => {
                setSelectedInstanceId(id)

                if (!id || !instance) return

                // Pre-fill form with instance data
                setFormData(prev => ({
                  ...prev,
                  serialNumber: instance.serialNumber,
                  priceAtPurchase: instance.priceAtPurchase,
                  status: instance.status,
                  quantity: instance.quantity,
                  economicLifespan: instance.economicLifespan,
                  depreciationPriceAtPurchase: instance.depreciationPriceAtPurchase,
                  ncsCode: instance.ncsCode || '',
                  warrantyMonths: instance.warrantyMonths,
                  warrantyStartDate: instance.warrantyStartDate || '',
                }))
              }}
            />
          )}

          {/* Instance Details (show in 'existing' mode when instance selected) */}
          {installationMode === 'existing' && selectedInstanceId && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Komponentinformation (skrivskyddad)</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="serialNumber-existing">Serienummer</Label>
                <Input
                  id="serialNumber-existing"
                  value={formData.serialNumber}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <Label htmlFor="status-existing">Status</Label>
                <select
                  id="status-existing"
                  value={formData.status}
                  disabled
                  className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm cursor-not-allowed"
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
                <Label htmlFor="quantity-existing">Antal</Label>
                <Input
                  id="quantity-existing"
                  type="number"
                  value={formData.quantity}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <Label htmlFor="ncsCode-existing">NCS-kod</Label>
                <Input
                  id="ncsCode-existing"
                  value={formData.ncsCode}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          </div>
          )}

          {/* Warranty Information (editable in 'existing' mode) */}
          {installationMode === 'existing' && selectedInstanceId && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Garantiinformation (redigerbar)</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="warrantyStartDate-existing">Garantistartdatum (valfritt)</Label>
                <Input
                  id="warrantyStartDate-existing"
                  type="date"
                  value={formData.warrantyStartDate}
                  onChange={(e) => handleChange('warrantyStartDate', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="warrantyMonths-existing">Garanti (månader)</Label>
                <Input
                  id="warrantyMonths-existing"
                  type="number"
                  min="0"
                  value={formData.warrantyMonths}
                  onChange={(e) => handleChange('warrantyMonths', parseInt(e.target.value) || 0)}
                />
                {errors.warrantyMonths && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.warrantyMonths}
                  </p>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Pricing Information (read-only in 'existing' mode) */}
          {installationMode === 'existing' && selectedInstanceId && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Prisinformation (skrivskyddad)</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priceAtPurchase-existing">Inköpspris (kr)</Label>
                <Input
                  id="priceAtPurchase-existing"
                  type="number"
                  value={formData.priceAtPurchase}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <Label htmlFor="depreciationPriceAtPurchase-existing">
                  Avskrivningspris (kr)
                </Label>
                <Input
                  id="depreciationPriceAtPurchase-existing"
                  type="number"
                  value={formData.depreciationPriceAtPurchase}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="economicLifespan-existing">Ekonomisk livslängd (år)</Label>
              <Input
                id="economicLifespan-existing"
                type="number"
                value={formData.economicLifespan}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
          )}

          {/* Instance Details (only in 'new' mode) */}
          {installationMode === 'new' && (
            <div className="space-y-4 border-t pt-4">
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
                  onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 0)}
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
          )}

          {/* Warranty Information (only in 'new' mode) */}
          {installationMode === 'new' && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Garantiinformation</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="warrantyStartDate">Garantistartdatum (valfritt)</Label>
                <Input
                  id="warrantyStartDate"
                  type="date"
                  value={formData.warrantyStartDate}
                  onChange={(e) => handleChange('warrantyStartDate', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="warrantyMonths">Garanti (månader) *</Label>
                <Input
                  id="warrantyMonths"
                  type="number"
                  min="0"
                  value={formData.warrantyMonths}
                  onChange={(e) => handleChange('warrantyMonths', parseInt(e.target.value) || 0)}
                />
                {errors.warrantyMonths && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.warrantyMonths}
                  </p>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Pricing Information (only in 'new' mode) */}
          {installationMode === 'new' && (
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
                  onChange={(e) => handleChange('priceAtPurchase', parseFloat(e.target.value) || 0)}
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
                  onChange={(e) => handleChange('depreciationPriceAtPurchase', parseFloat(e.target.value) || 0)}
                  placeholder={
                    selectedModel?.subtype?.depreciationPrice
                      ? `Standard: ${selectedModel.subtype.depreciationPrice} kr`
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
              <Label htmlFor="economicLifespan">Ekonomisk livslängd (år) *</Label>
              <Input
                id="economicLifespan"
                type="number"
                min="0"
                value={formData.economicLifespan}
                onChange={(e) => handleChange('economicLifespan', parseInt(e.target.value) || 0)}
                placeholder={
                  selectedModel?.subtype?.economicLifespan
                    ? `Standard: ${selectedModel.subtype.economicLifespan} år`
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
          )}

          {/* Installation Details (always shown) */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium">Installationsdetaljer</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="installationDate">Installationsdatum *</Label>
                <Input
                  id="installationDate"
                  type="date"
                  value={formData.installationDate}
                  onChange={(e) => handleChange('installationDate', e.target.value)}
                />
                {errors.installationDate && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.installationDate}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="installationCost">Installationskostnad (kr) *</Label>
                <Input
                  id="installationCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.installationCost}
                  onChange={(e) => handleChange('installationCost', parseFloat(e.target.value) || 0)}
                />
                {errors.installationCost && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.installationCost}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="orderNumber">Ordernummer (valfritt)</Label>
              <Input
                id="orderNumber"
                value={formData.orderNumber}
                onChange={(e) => handleChange('orderNumber', e.target.value)}
                placeholder="ORD-2024-001"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" disabled={installMutation.isPending}>
              {installMutation.isPending ? 'Installerar...' : 'Installera'}
            </Button>
          </DialogFooter>

          {installMutation.isError && (
            <p className="text-sm text-destructive">
              Ett fel uppstod vid installation. Försök igen.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
