interface PageHeaderProps {
  /** Main page title */
  title: string
  /** Subtitle showing counts, e.g. "5 av 100 nycklar" */
  subtitle: string
  /** Optional badges or other content to show on the right side */
  badges?: React.ReactNode
}

/** Shared page header with title, subtitle, and optional badges */
export function PageHeader({ title, subtitle, badges }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {badges && <div className="flex items-center gap-2">{badges}</div>}
    </div>
  )
}
