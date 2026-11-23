import { useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Mail,
  Pencil,
  Send,
} from 'lucide-react'

import { parkingSpaceService } from '@/services/api/core/parkingSpaceService'

import { useToast } from '@/shared/hooks/useToast'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import { ViewLayout } from '@/shared/ui/layout'

type CompanyList = {
  id: string
  name: string
  description: string
  defaultRecipient: string
  buildCsv: () => Promise<{ filename: string; csv: string; rowCount: number }>
}

const today = () => new Date().toISOString().split('T')[0]

// Semicolon-separated so Swedish Excel opens it in columns.
const toCsv = (header: string[], rows: (string | number)[][]) =>
  [header, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell)
          return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(';')
    )
    .join('\r\n')

const downloadFile = (filename: string, csv: string) => {
  // The BOM makes Excel read å, ä and ö correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 1000)
}

const SECURITAS_EXCLUDED_TYPES = [
  'Besöksparkering',
  'Parkering Centrumanläggning',
  'Parkeringsplats för rörelsehindrade',
]

const buildSecuritasCsv = async () => {
  const date = today()
  const spaces = await parkingSpaceService.getVacant()
  const rows = spaces
    .filter(
      (space) =>
        !(space.rentalObjectCode ?? '').startsWith('000-') &&
        !SECURITAS_EXCLUDED_TYPES.includes(space.objectTypeCaption ?? '') &&
        (!space.vacantFrom || space.vacantFrom.slice(0, 10) <= date)
    )
    .sort((a, b) =>
      (a.rentalObjectCode ?? '').localeCompare(b.rentalObjectCode ?? '')
    )
    .map((space) => [
      space.rentalObjectCode ?? '',
      space.objectTypeCaption ?? '',
      space.address ?? '',
      space.propertyCaption ?? '',
      space.districtCaption ?? '',
      space.vacantFrom?.slice(0, 10) ?? '',
      space.rent?.amount ?? '',
    ])

  return {
    filename: `securitas-${date}.csv`,
    csv: toCsv(
      [
        'Hyres-ID',
        'Typ',
        'Adress',
        'Fastighet',
        'Distrikt',
        'Ledig från',
        'Hyra',
      ],
      rows
    ),
    rowCount: rows.length,
  }
}

// The company's fixed lists. Sending is not wired to a backend yet.
const companyLists: CompanyList[] = [
  {
    id: 'securitas',
    name: 'Securitas',
    description:
      'Bilplatser som är lediga till och med idag, utom besöksparkering, Parkering Centrumanläggning, parkeringsplatser för rörelsehindrade och testobjekt (hyres-ID som börjar med 000-).',
    defaultRecipient: 'adalid.zegarra@mimer.nu',
    buildCsv: buildSecuritasCsv,
  },
]

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

// Until recipients are stored in the backend, a changed recipient is kept in
// this browser only. Storage may be unavailable, so every access is guarded.
const storageKey = (listId: string) => `lists.recipient.${listId}`

const loadRecipient = (list: CompanyList) => {
  try {
    return localStorage.getItem(storageKey(list.id)) ?? list.defaultRecipient
  } catch {
    return list.defaultRecipient
  }
}

const saveRecipient = (listId: string, email: string) => {
  try {
    localStorage.setItem(storageKey(listId), email)
  } catch {
    // Not persisted; the recipient still applies for this visit.
  }
}

function ListCard({ list }: { list: CompanyList }) {
  const { toast } = useToast()
  const [recipient, setRecipient] = useState(() => loadRecipient(list))
  const [draft, setDraft] = useState(recipient)
  const [isEditing, setIsEditing] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const draftIsValid = isValidEmail(draft)

  const handleSave = () => {
    if (!draftIsValid) return
    const email = draft.trim()
    setRecipient(email)
    saveRecipient(list.id, email)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setDraft(recipient)
    setIsEditing(false)
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const { filename, csv, rowCount } = await list.buildCsv()
      downloadFile(filename, csv)
      toast({
        title: `${list.name} hämtad`,
        description: `${rowCount} rader i ${filename}`,
      })
    } catch {
      toast({
        title: `Kunde inte hämta ${list.name}`,
        description: 'Försök igen om en stund.',
        variant: 'destructive',
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleSend = () => {
    toast({
      title: `${list.name} skickades inte till ${recipient}`,
      description: 'Utskick är inte kopplat än.',
    })
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <FileSpreadsheet className="h-8 w-8 shrink-0 text-primary" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{list.name}</h2>
              <Badge variant="secondary">Ej kopplad</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{list.description}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={isDownloading}
              className="gap-2"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Ladda ner
            </Button>
            <Button onClick={handleSend} disabled={isEditing} className="gap-2">
              <Send className="h-4 w-4" />
              Skicka
            </Button>
          </div>
        </div>

        <div className="border-t pt-4">
          {isEditing ? (
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault()
                handleSave()
              }}
            >
              <div className="flex-1 space-y-1">
                <Label htmlFor={`recipient-${list.id}`}>E-post</Label>
                <Input
                  id={`recipient-${list.id}`}
                  type="email"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  aria-invalid={!draftIsValid}
                  autoFocus
                />
                {!draftIsValid && (
                  <p className="text-sm text-destructive">
                    Ange en giltig e-postadress.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={!draftIsValid}>
                  Spara
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Avbryt
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Skickas till</span>
              <span className="font-medium">{recipient}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto gap-1"
                onClick={() => {
                  setDraft(recipient)
                  setIsEditing(true)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Ändra e-post
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function ListsPage() {
  return (
    <ViewLayout className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Listor</h1>
        <p className="text-muted-foreground mt-1">
          Färdiga listor att hämta eller få mejlade
        </p>
      </div>

      <div className="space-y-3">
        {companyLists.map((list) => (
          <ListCard key={list.id} list={list} />
        ))}
      </div>
    </ViewLayout>
  )
}
