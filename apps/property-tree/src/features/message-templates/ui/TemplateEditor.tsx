import { useMemo, useState } from 'react'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import {
  Bold,
  Braces,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  MousePointerClick,
  Plus,
  Table2,
  Trash2,
} from 'lucide-react'

import type { TemplatePlaceholder } from '@/entities/system-template'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu'

import type { AddressKind } from '../lib/editor/addresses'
import { templateExtensions } from '../lib/editor/extensions'
import {
  PLACEHOLDER_MARK,
  placeholderText,
} from '../lib/editor/placeholderMark'
import { AddressDialog, type AddressValue } from './AddressDialog'

// Mirrors services/communication/.../render/styles.ts (Arial 14px, purple
// links, teal button, bold fact labels, 480px images). The preview is exact.
const contentClassName = cn(
  'min-h-[240px] px-[10px] py-5 text-[14px] leading-[140%] text-black focus:outline-none',
  'font-[arial,helvetica,sans-serif]',
  '[&_p]:mb-[14px] [&_h2]:mb-[14px] [&_h2]:text-[20px] [&_h2]:font-bold [&_h2]:text-[#00a4b3]',
  '[&_h3]:mb-1 [&_h3]:text-[16px] [&_h3]:font-bold [&_h3]:text-[#00a4b3]',
  '[&_ul]:mb-[14px] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-[14px] [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_li_p]:mb-0',
  '[&_a]:text-[#951b81] [&_a]:underline',
  '[&_a[title=button]]:inline-block [&_a[title=button]]:rounded [&_a[title=button]]:bg-[#00a4b3] [&_a[title=button]]:px-5 [&_a[title=button]]:py-2.5 [&_a[title=button]]:font-bold [&_a[title=button]]:text-white [&_a[title=button]]:no-underline',
  // Fact tables: the empty header row is hidden, the first column bold. The
  // dashed cell lines exist only here, so it is clear where a cell ends.
  '[&_table]:mb-[14px] [&_table]:w-full [&_td]:py-1 [&_td]:pl-1 [&_td]:pr-2 [&_td]:align-top [&_td_p]:mb-0 [&_td:first-child]:font-bold [&_tr:has(th)]:hidden',
  '[&_td]:border [&_td]:border-dashed [&_td]:border-gray-300 [&_.selectedCell]:bg-blue-50',
  '[&_img]:mb-[14px] [&_img]:block [&_img]:min-h-[60px] [&_img]:w-[480px] [&_img]:max-w-full [&_img]:border [&_img]:border-dashed [&_img]:border-gray-400',
  '[&_.template-placeholder]:rounded [&_.template-placeholder]:bg-amber-100 [&_.template-placeholder]:px-1 [&_.template-placeholder]:text-amber-900'
)

export interface EmailFrame {
  logoUrl: string | null
  footerLines: string[]
}

interface TemplateEditorProps {
  value: string // markdown, read once on mount
  onChange: (markdown: string) => void
  placeholders: TemplatePlaceholder[] // empty hides the placeholder button
  frame?: EmailFrame // locked logo and footer around an email template
  disabled?: boolean
  ariaLabelledBy?: string
}

type AddressRequest = { kind: AddressKind; initial: AddressValue }

/**
 * Visual editor for every template. It reads and writes markdown, which the
 * user never sees; the toolbar offers only what the email renderer styles.
 */
export function TemplateEditor({
  value,
  onChange,
  placeholders,
  frame,
  disabled = false,
  ariaLabelledBy,
}: TemplateEditorProps) {
  const labels = useMemo(
    () => Object.fromEntries(placeholders.map((p) => [p.token, p.label])),
    [placeholders]
  )
  const [address, setAddress] = useState<AddressRequest | null>(null)

  const editor = useEditor({
    extensions: [...templateExtensions(labels), Markdown],
    content: value,
    contentType: 'markdown',
    editable: !disabled,
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: contentClassName,
        ...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {}),
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getMarkdown()),
  })

  if (!editor) return null

  const urlPlaceholders = placeholders.filter((p) => p.kind === 'url')
  const textPlaceholders = placeholders.filter((p) => p.kind !== 'url')

  const openAddress = (kind: AddressKind) => {
    const { from, to } = editor.state.selection
    const link = editor.getAttributes('link')
    setAddress({
      kind,
      initial: {
        text: kind === 'image' ? '' : editor.state.doc.textBetween(from, to),
        href: kind === 'link' && typeof link.href === 'string' ? link.href : '',
      },
    })
  }

  const applyAddress = ({ text, href }: AddressValue) => {
    const kind = address?.kind
    setAddress(null)
    const chain = editor.chain().focus()
    if (kind === 'image') {
      chain.setImage({ src: href, alt: text }).run()
    } else if (kind === 'button') {
      // A button stands in a paragraph of its own, as in the seeds.
      chain
        .insertContent({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text,
              marks: [{ type: 'link', attrs: { href, title: 'button' } }],
            },
          ],
        })
        .run()
    } else if (editor.state.selection.empty || text) {
      chain
        .insertContent({
          type: 'text',
          text: text || href,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run()
    } else {
      chain.extendMarkRange('link').setLink({ href }).run()
    }
  }

  const insertPlaceholder = (placeholder: TemplatePlaceholder) => {
    const chip = {
      type: 'text',
      text: placeholderText(placeholder.token),
      marks: [{ type: PLACEHOLDER_MARK, attrs: { token: placeholder.token } }],
    }
    // Sender HTML only renders as HTML alone in its paragraph.
    editor
      .chain()
      .focus()
      .insertContent(
        placeholder.kind === 'block'
          ? { type: 'paragraph', content: [chip] }
          : chip
      )
      .run()
  }

  const inTable = editor.isActive('table')

  return (
    <div
      className={cn(
        'rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        disabled && 'cursor-not-allowed opacity-70'
      )}
    >
      <div
        className="flex flex-wrap items-center gap-1 border-b px-1 py-1"
        role="toolbar"
        aria-label="Formatering"
      >
        <ToolbarButton
          label="Fet"
          active={editor.isActive('bold')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="Kursiv"
          active={editor.isActive('italic')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="Rubrik"
          active={editor.isActive('heading', { level: 2 })}
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          label="Underrubrik"
          active={editor.isActive('heading', { level: 3 })}
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 />
        </ToolbarButton>
        <ToolbarButton
          label="Punktlista"
          active={editor.isActive('bulletList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="Numrerad lista"
          active={editor.isActive('orderedList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label="Länk"
          active={editor.isActive('link')}
          disabled={disabled}
          onClick={() => openAddress('link')}
        >
          <Link2 />
        </ToolbarButton>
        <ToolbarButton
          label="Knapp"
          active={false}
          disabled={disabled}
          onClick={() => openAddress('button')}
        >
          <MousePointerClick />
        </ToolbarButton>
        <ToolbarButton
          label="Bild"
          active={false}
          disabled={disabled}
          onClick={() => openAddress('image')}
        >
          <ImageIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Faktatabell"
          active={inTable}
          disabled={disabled || inTable}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 2, withHeaderRow: true })
              .run()
          }
        >
          <Table2 />
        </ToolbarButton>
        {inTable && (
          <>
            <ToolbarButton
              label="Lägg till rad"
              active={false}
              disabled={disabled}
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <Plus />
            </ToolbarButton>
            <ToolbarButton
              label="Ta bort rad"
              active={false}
              disabled={disabled}
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              <Minus />
            </ToolbarButton>
            <ToolbarButton
              label="Ta bort tabell"
              active={false}
              disabled={disabled}
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              <Trash2 />
            </ToolbarButton>
          </>
        )}
        {textPlaceholders.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                disabled={disabled}
              >
                <Braces />
                Platshållare
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {textPlaceholders.map((p) => (
                <DropdownMenuItem
                  key={p.token}
                  onSelect={() => insertPlaceholder(p)}
                >
                  <span>{p.label}</span>
                  <span className="ml-auto pl-4 text-xs text-muted-foreground">
                    {p.example.length > 30
                      ? `${p.example.slice(0, 30)}…`
                      : p.example}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto bg-white">
        <div className="mx-auto w-full max-w-[500px]">
          {frame?.logoUrl && (
            <div
              className="select-none px-[10px] py-4 opacity-60"
              title="Logotypen kan inte ändras här"
            >
              <img src={frame.logoUrl} alt="" width={104} />
            </div>
          )}
          <EditorContent editor={editor} />
          {frame && frame.footerLines.length > 0 && (
            <div
              className="select-none bg-[#00a4b3] px-[10px] py-4 font-[arial,helvetica,sans-serif] text-[12px] leading-[140%] text-black opacity-60"
              title="Sidfoten kan inte ändras här"
            >
              {frame.footerLines.map((line) => (
                <p key={line} className="mb-1.5">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddressDialog
        kind={address?.kind ?? null}
        initial={address?.initial ?? { text: '', href: '' }}
        urlPlaceholders={urlPlaceholders}
        textOptional={address?.kind === 'link' && !editor.state.selection.empty}
        onSubmit={applyAddress}
        onCancel={() => setAddress(null)}
      />
    </div>
  )
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className="h-8 w-8"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </Button>
  )
}
