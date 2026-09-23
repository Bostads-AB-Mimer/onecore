import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Link2, List, ListOrdered } from 'lucide-react'

import { useToast } from '@/shared/hooks/useToast'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'

interface RichTextEditorProps {
  id?: string
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** Makes the content read-only, e.g. while the form is saving. */
  disabled?: boolean
  className?: string
}

const contentClassName =
  'min-h-[120px] px-3 py-2 text-sm leading-relaxed focus:outline-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_a]:text-primary [&_a]:underline'

/**
 * Small WYSIWYG editor limited to the HTML subset guide bodies allow:
 * paragraphs, bold, bullet and numbered lists, links.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
}: RichTextEditorProps) {
  const { toast } = useToast()
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        // No target by default; setLink only adds _blank for absolute
        // http(s) links so internal links stay in the same tab.
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer' },
        },
      }),
    ],
    content: value,
    // The contenteditable surface ignores a disabled <fieldset>, so the
    // editable flag is what keeps edits out during a save.
    editable: !disabled,
    // Render synchronously so tests and SSR-less mounts get the editor at once.
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: contentClassName,
        ...(id ? { id } : {}),
        ...(placeholder ? { 'aria-placeholder': placeholder } : {}),
      },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML()
      // Tiptap represents "nothing" as an empty paragraph.
      onChange(html === '<p></p>' ? '' : html)
    },
  })

  // Sync external changes (e.g. loading a guide) without moving the caret
  // while the user types.
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const normalizedCurrent = current === '<p></p>' ? '' : current
    if (normalizedCurrent !== value) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    // tiptap emits an update on setEditable by default, which would report
    // the unchanged content as an edit after every save.
    if (editor && editor.isEditable === disabled) {
      editor.setEditable(!disabled, false)
    }
  }, [editor, disabled])

  if (!editor) return null

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Länkadress (https://... eller /sida)', previous)
    if (url === null) return
    const href = url.trim()
    if (href === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    // Tiptap rejects schemes outside its allowlist and returns false.
    const isExternal = /^https?:\/\//i.test(href)
    const applied = editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href, target: isExternal ? '_blank' : null })
      .run()
    if (!applied) {
      toast({
        title: 'Ogiltig länk',
        description: 'Använd en adress som börjar med https:// eller /.',
        variant: 'destructive',
      })
    }
  }

  const toolbarButton = (
    label: string,
    icon: React.ReactNode,
    active: boolean,
    onClick: () => void
  ) => (
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
      {icon}
    </Button>
  )

  return (
    <div
      className={cn(
        'rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        disabled && 'cursor-not-allowed opacity-70',
        className
      )}
    >
      <div
        className="flex items-center gap-1 border-b px-1 py-1"
        role="toolbar"
        aria-label="Formatering"
      >
        {toolbarButton(
          'Fet',
          <Bold className="h-4 w-4" />,
          editor.isActive('bold'),
          () => editor.chain().focus().toggleBold().run()
        )}
        {toolbarButton(
          'Punktlista',
          <List className="h-4 w-4" />,
          editor.isActive('bulletList'),
          () => editor.chain().focus().toggleBulletList().run()
        )}
        {toolbarButton(
          'Numrerad lista',
          <ListOrdered className="h-4 w-4" />,
          editor.isActive('orderedList'),
          () => editor.chain().focus().toggleOrderedList().run()
        )}
        {toolbarButton(
          'Länk',
          <Link2 className="h-4 w-4" />,
          editor.isActive('link'),
          setLink
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
