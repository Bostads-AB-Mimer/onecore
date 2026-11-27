import { useState } from 'react'

import type { TemplatePlaceholder } from '@/entities/system-template'

import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

import {
  type AddressKind,
  addressHint,
  isAllowedAddress,
} from '../lib/editor/addresses'
import { placeholderText } from '../lib/editor/placeholderMark'

const TITLES: Record<AddressKind, string> = {
  link: 'Länk',
  button: 'Knapp',
  image: 'Bild',
}

const TEXT_LABELS: Record<AddressKind, string> = {
  link: 'Länktext',
  button: 'Text på knappen',
  image: 'Beskrivning (visas om bilden inte laddas)',
}

const NO_PLACEHOLDER = '__none__'

export interface AddressValue {
  text: string
  href: string
}

interface AddressDialogProps {
  kind: AddressKind | null // null = closed
  initial: AddressValue
  urlPlaceholders: TemplatePlaceholder[] // offered as the address
  // Links can wrap the selected text, so their text is optional.
  textOptional?: boolean
  onSubmit: (value: AddressValue) => void
  onCancel: () => void
}

/** Text plus address for a link, button or image, typed or a placeholder. */
export function AddressDialog({
  kind,
  initial,
  urlPlaceholders,
  textOptional = false,
  onSubmit,
  onCancel,
}: AddressDialogProps) {
  return (
    <Dialog
      open={kind !== null}
      onOpenChange={(open: boolean) => !open && onCancel()}
    >
      <DialogContent className="max-w-md">
        {kind && (
          <AddressForm
            kind={kind}
            initial={initial}
            urlPlaceholders={urlPlaceholders}
            textOptional={textOptional}
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AddressForm({
  kind,
  initial,
  urlPlaceholders,
  textOptional,
  onSubmit,
  onCancel,
}: Omit<AddressDialogProps, 'kind'> & { kind: AddressKind }) {
  const [text, setText] = useState(initial.text)
  const [href, setHref] = useState(initial.href)
  const [showError, setShowError] = useState(false)

  const urlTokens = urlPlaceholders.map((p) => p.token)
  const chosenToken = urlTokens.find((t) => placeholderText(t) === href.trim())
  const addressOk = isAllowedAddress(href, kind, urlTokens)
  const textOk = textOptional || kind === 'image' || text.trim() !== ''

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        // React bubbles submit through the portal to the template form, which would save.
        e.stopPropagation()
        if (!addressOk || !textOk) {
          setShowError(true)
          return
        }
        onSubmit({ text: text.trim(), href: href.trim() })
      }}
    >
      <DialogHeader>
        <DialogTitle>{TITLES[kind]}</DialogTitle>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="address-text">{TEXT_LABELS[kind]}</Label>
        <Input
          id="address-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address-href">Adress</Label>
        <Input
          id="address-href"
          value={chosenToken ? '' : href}
          placeholder={
            chosenToken
              ? 'Platshållaren nedan används'
              : kind === 'image'
                ? 'https://...'
                : 'https://..., mailto:... eller tel:...'
          }
          disabled={chosenToken !== undefined}
          onChange={(e) => setHref(e.target.value)}
        />
      </div>

      {urlPlaceholders.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="address-placeholder">Eller en platshållare</Label>
          <Select
            value={chosenToken ?? NO_PLACEHOLDER}
            onValueChange={(value) =>
              setHref(value === NO_PLACEHOLDER ? '' : placeholderText(value))
            }
          >
            <SelectTrigger id="address-placeholder">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PLACEHOLDER}>
                Ingen, skriv adressen
              </SelectItem>
              {urlPlaceholders.map((p) => (
                <SelectItem key={p.token} value={p.token}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showError && (!addressOk || !textOk) && (
        <p className="text-sm text-destructive">
          {textOk ? addressHint(kind) : 'Skriv en text.'}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit">Infoga</Button>
      </DialogFooter>
    </form>
  )
}
