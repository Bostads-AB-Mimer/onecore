/** Placeholder page while a section has no content yet. */
export function ShellPage({ title }: { title: string }) {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="py-8 text-center text-muted-foreground">
        Inget innehåll ännu
      </p>
    </div>
  )
}
