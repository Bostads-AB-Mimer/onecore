import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Label } from '@/shared/ui/Label'

import { type Checklist, CHECKLIST_ITEMS } from '../constants/checklist'

interface InspectionChecklistStepProps {
  isTenantPresent: boolean
  onIsTenantPresentChange: (value: boolean) => void
  isNewTenantPresent: boolean
  onIsNewTenantPresentChange: (value: boolean) => void
  isFurnished: boolean
  onIsFurnishedChange: (value: boolean) => void
  checklist: Checklist
  onChecklistItemChange: (key: keyof Checklist, value: boolean) => void
}

function YesNoToggle({
  value,
  onChange,
  ariaLabel,
}: {
  value: boolean
  onChange: (value: boolean) => void
  ariaLabel: string
}) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={ariaLabel}>
      <Button
        type="button"
        role="radio"
        aria-checked={value === true}
        variant={value ? 'default' : 'outline'}
        onClick={() => onChange(true)}
      >
        Ja
      </Button>
      <Button
        type="button"
        role="radio"
        aria-checked={value === false}
        variant={!value ? 'default' : 'outline'}
        onClick={() => onChange(false)}
      >
        Nej
      </Button>
    </div>
  )
}

/**
 * "Kontrollfrågor" step — sits between the rooms walkthrough and the summary.
 * Consolidates three prompts:
 *   1. Tenant + (incoming) tenant presence — moved from CreateInspectionDialog
 *   2. Is the apartment furnished — moved from InspectionSummary footer
 *   3. Safety/utility checklist (4 checks)
 *
 * The 4 checks are gating: "Slutför besiktning" is disabled until all four
 * are ticked.
 */
export function InspectionChecklistStep({
  isTenantPresent,
  onIsTenantPresentChange,
  isNewTenantPresent,
  onIsNewTenantPresentChange,
  isFurnished,
  onIsFurnishedChange,
  checklist,
  onChecklistItemChange,
}: InspectionChecklistStepProps) {
  return (
    <div className="space-y-4">
      <header className="border rounded-lg p-4 space-y-1 bg-card">
        <h2 className="text-xl font-semibold">Kontrollfrågor</h2>
        <p className="text-sm text-muted-foreground">
          Bekräfta närvaro, möblering och säkerhetskontroller innan besiktningen
          avslutas.
        </p>
      </header>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Var hyresgästen närvarande?
            </div>
            <YesNoToggle
              value={isTenantPresent}
              onChange={onIsTenantPresentChange}
              ariaLabel="Var hyresgästen närvarande?"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">
              Var ny hyresgäst närvarande?
            </div>
            <YesNoToggle
              value={isNewTenantPresent}
              onChange={onIsNewTenantPresentChange}
              ariaLabel="Var ny hyresgäst närvarande?"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="text-sm font-medium">
            Är bostaden möblerad vid besiktningstillfället?
          </div>
          <YesNoToggle
            value={isFurnished}
            onChange={onIsFurnishedChange}
            ariaLabel="Är bostaden möblerad vid besiktningstillfället?"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="text-sm font-medium">Säkerhetskontroller</div>
          <p className="text-xs text-muted-foreground">
            Alla fyra punkter måste bockas innan besiktningen kan slutföras.
          </p>
          <div className="space-y-2">
            {CHECKLIST_ITEMS.map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-3 text-sm cursor-pointer"
              >
                <Checkbox
                  id={`checklist-${item.key}`}
                  checked={checklist[item.key]}
                  onCheckedChange={(checked) =>
                    onChecklistItemChange(item.key, checked === true)
                  }
                />
                <Label
                  htmlFor={`checklist-${item.key}`}
                  className="cursor-pointer"
                >
                  {item.label}
                </Label>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
