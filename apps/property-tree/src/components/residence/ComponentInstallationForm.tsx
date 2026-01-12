import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/v2/Label'
import { Button } from '@/components/ui/v2/Button'
import {
  ModelSelector,
  type ComponentModelWithHierarchy,
} from './ModelSelector'
import { InstanceSelector } from './InstanceSelector'
import { useInstallComponent } from '@/components/hooks/useInstallComponent'
import { componentService } from '@/services/api/core/componentService'
import { useQueryClient } from '@tanstack/react-query'

export interface InstallationFormData {
  modelId: string
  serialNumber: string
  warrantyStartDate: string
  warrantyMonths: number
  priceAtPurchase: number
  depreciationPriceAtPurchase: number
  economicLifespan: number
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED'
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED' | null
  quantity: number
  ncsCode: string
  installationDate: string
  installationCost: number
  orderNumber: string
}

const getInitialFormData = (): InstallationFormData => ({
  modelId: '',
  serialNumber: '',
  warrantyStartDate: '',
  warrantyMonths: 0,
  priceAtPurchase: 0,
  depreciationPriceAtPurchase: 0,
  economicLifespan: 0,
  status: 'ACTIVE',
  condition: null,
  quantity: 1,
  ncsCode: '',
  installationDate: new Date().toISOString().split('T')[0],
  installationCost: 0,
  orderNumber: '',
})

interface ComponentInstallationFormProps {
  propertyObjectId: string
  roomId: string
  onSuccess: () => void
  onCancel: () => void
}

export const ComponentInstallationForm = ({
  propertyObjectId,
  roomId,
  onSuccess,
  onCancel,
}: ComponentInstallationFormProps) => {
  const queryClient = useQueryClient()
  const [installationMode, setInstallationMode] = useState<'new' | 'existing'>(
    'new'
  )
  const [selectedModel, setSelectedModel] = useState<
    ComponentModelWithHierarchy | undefined
  >()
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('')
  const installMutation = useInstallComponent(propertyObjectId, roomId)

  const [formData, setFormData] =
    useState<InstallationFormData>(getInitialFormData())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Reset form when component mounts
  useEffect(() => {
    setFormData(getInitialFormData())
    setErrors({})
    setSelectedModel(undefined)
    setSelectedInstanceId('')
    setInstallationMode('new')
  }, [])

  // Update form defaults when model is selected
  useEffect(() => {
    if (selectedModel) {
      setFormData((prev) => ({
        ...prev,
        warrantyMonths: selectedModel.warrantyMonths || 0,
        priceAtPurchase: selectedModel.currentPrice || 0,
        installationCost: selectedModel.currentInstallPrice || 0,
        economicLifespan: selectedModel.subtype?.economicLifespan || 0,
        depreciationPriceAtPurchase:
          selectedModel.subtype?.depreciationPrice || 0,
      }))
    }
  }, [selectedModel])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (installationMode === 'new') {
        await installMutation.mutateAsync({
          modelId: formData.modelId,
          serialNumber: formData.serialNumber,
          warrantyStartDate: formData.warrantyStartDate || undefined,
          warrantyMonths: formData.warrantyMonths,
          priceAtPurchase: formData.priceAtPurchase,
          depreciationPriceAtPurchase: formData.depreciationPriceAtPurchase,
          economicLifespan: formData.economicLifespan,
          status: formData.status,
          condition: formData.condition,
          quantity: formData.quantity,
          ncsCode: formData.ncsCode || undefined,
          installationDate: formData.installationDate,
          installationCost: formData.installationCost,
          orderNumber: formData.orderNumber || undefined,
        })
      } else {
        if (!selectedInstanceId) {
          throw new Error('No instance selected')
        }

        await componentService.updateInstance(selectedInstanceId, {
          warrantyMonths: formData.warrantyMonths,
          warrantyStartDate: formData.warrantyStartDate || undefined,
        })

        await componentService.installExistingInstance(
          selectedInstanceId,
          propertyObjectId,
          {
            installationDate: formData.installationDate,
            installationCost: formData.installationCost,
            orderNumber: formData.orderNumber || undefined,
          }
        )

        queryClient.invalidateQueries({ queryKey: ['components', propertyObjectId] })
        queryClient.invalidateQueries({
          queryKey: ['instances', 'uninstalled'],
        })
        queryClient.invalidateQueries({ queryKey: ['instances'] })
      }
      onSuccess()
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { errors?: Record<string, string> } }
      }
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors)
      }
      console.error('Failed to install component:', error)
    }
  }

  return (
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
          setSelectedInstanceId('')
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

            setFormData((prev) => ({
              ...prev,
              serialNumber: instance.serialNumber ?? '',
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
              <Label htmlFor="warrantyStartDate-existing">
                Garantistartdatum (valfritt)
              </Label>
              <Input
                id="warrantyStartDate-existing"
                type="date"
                value={formData.warrantyStartDate}
                onChange={(e) =>
                  handleChange('warrantyStartDate', e.target.value)
                }
              />
            </div>

            <div>
              <Label htmlFor="warrantyMonths-existing">Garanti (månader)</Label>
              <Input
                id="warrantyMonths-existing"
                type="number"
                min="0"
                value={formData.warrantyMonths}
                onChange={(e) =>
                  handleChange('warrantyMonths', parseInt(e.target.value) || 0)
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
            <Label htmlFor="economicLifespan-existing">
              Ekonomisk livslängd (år)
            </Label>
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
              <Label htmlFor="condition">Skick</Label>
              <select
                id="condition"
                value={formData.condition || ''}
                onChange={(e) =>
                  handleChange('condition', e.target.value || null)
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Ej angivet</option>
                <option value="NEW">Nyskick</option>
                <option value="GOOD">Gott skick</option>
                <option value="FAIR">Godtagbart skick</option>
                <option value="POOR">Dåligt skick</option>
                <option value="DAMAGED">Skadat</option>
              </select>
            </div>

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
      )}

      {/* Warranty Information (only in 'new' mode) */}
      {installationMode === 'new' && (
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
                  handleChange('warrantyMonths', parseInt(e.target.value) || 0)
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
              onChange={(e) =>
                handleChange('economicLifespan', parseInt(e.target.value) || 0)
              }
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
            <Label htmlFor="installationCost">
              Installationskostnad (kr) *
            </Label>
            <Input
              id="installationCost"
              type="number"
              min="0"
              step="0.01"
              value={formData.installationCost}
              onChange={(e) =>
                handleChange(
                  'installationCost',
                  parseFloat(e.target.value) || 0
                )
              }
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

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit" disabled={installMutation.isPending}>
          {installMutation.isPending ? 'Installerar...' : 'Installera'}
        </Button>
      </div>

      {installMutation.isError && (
        <p className="text-sm text-destructive">
          Ett fel uppstod vid installation. Försök igen.
        </p>
      )}
    </form>
  )
}
