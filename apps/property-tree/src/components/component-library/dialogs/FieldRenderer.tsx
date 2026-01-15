import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/v2/Label'
import type { FieldConfig } from '../entity-dialog-config'

interface FieldRendererProps {
  field: FieldConfig
  value: any
  onChange: (name: string, value: any) => void
  error?: string
}

export function FieldRenderer({
  field,
  value,
  onChange,
  error,
}: FieldRendererProps) {
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    let newValue: any = e.target.value
    if (field.type === 'number') {
      // Keep empty string as empty (don't convert to 0)
      newValue = e.target.value === '' ? '' : Number(e.target.value)
    }
    onChange(field.name, newValue)
  }

  switch (field.type) {
    case 'text':
      return (
        <div>
          <Label htmlFor={field.name}>
            {field.label} {field.required && '*'}
          </Label>
          <Input
            id={field.name}
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder={field.placeholder}
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
      )

    case 'number':
      return (
        <div>
          <Label htmlFor={field.name}>
            {field.label} {field.required && '*'}
          </Label>
          <Input
            id={field.name}
            type="number"
            min="0"
            step={
              field.name.includes('Price') || field.name.includes('cost')
                ? '0.01'
                : '1'
            }
            value={value ?? field.defaultValue ?? ''}
            onChange={handleChange}
            placeholder={field.placeholder}
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
      )

    case 'textarea':
      return (
        <div>
          <Label htmlFor={field.name}>
            {field.label} {field.required && '*'}
          </Label>
          <textarea
            id={field.name}
            value={value || ''}
            onChange={handleChange}
            placeholder={field.placeholder}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
      )

    case 'select':
      return (
        <div>
          <Label htmlFor={field.name}>
            {field.label} {field.required && '*'}
          </Label>
          <select
            id={field.name}
            value={value || field.defaultValue}
            onChange={handleChange}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
      )

    case 'date':
      // Convert ISO date string to yyyy-MM-dd format for HTML date input
      const dateValue = value
        ? value.includes('T')
          ? value.split('T')[0]
          : value
        : ''
      return (
        <div>
          <Label htmlFor={field.name}>
            {field.label} {field.required && '*'}
          </Label>
          <Input
            id={field.name}
            type="date"
            value={dateValue}
            onChange={handleChange}
            placeholder={field.placeholder}
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
      )

    default:
      return null
  }
}
