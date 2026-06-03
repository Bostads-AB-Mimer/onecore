import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

import {
  COST_RESPONSIBILITY,
  COST_RESPONSIBILITY_LABEL,
  type CostResponsibility,
} from '../constants/costResponsibility'

// Sentinel used in the <Select> since shadcn's SelectItem disallows empty values.
// Parsed back to `null` before reaching the handler.
const UNSET = '__unset__'

interface CostResponsibilitySelectProps {
  value: CostResponsibility
  onChange: (value: CostResponsibility) => void
  ariaLabel: string
}

export function CostResponsibilitySelect({
  value,
  onChange,
  ariaLabel,
}: CostResponsibilitySelectProps) {
  return (
    <Select
      value={value ?? UNSET}
      onValueChange={(v) =>
        onChange(v === UNSET ? null : (v as Exclude<CostResponsibility, null>))
      }
    >
      <SelectTrigger className="h-9" aria-label={ariaLabel}>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>—</SelectItem>
        <SelectItem value={COST_RESPONSIBILITY.TENANT}>
          {COST_RESPONSIBILITY_LABEL[COST_RESPONSIBILITY.TENANT]}
        </SelectItem>
        <SelectItem value={COST_RESPONSIBILITY.LANDLORD}>
          {COST_RESPONSIBILITY_LABEL[COST_RESPONSIBILITY.LANDLORD]}
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
