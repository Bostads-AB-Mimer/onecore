import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface CommentInputProps {
  value: string
  onChange: (value: string) => void
  maxLength?: number
  label?: string
  placeholder?: string
  rows?: number
}

export function CommentInput({
  value,
  onChange,
  maxLength = 280,
  label = 'Kommentar',
  placeholder = 'Lägg till en kommentar...',
  rows = 3,
}: CommentInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value.slice(0, maxLength)
    onChange(newValue)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">
          {value.length}/{maxLength}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className="resize-none text-sm"
        maxLength={maxLength}
      />
    </div>
  )
}
