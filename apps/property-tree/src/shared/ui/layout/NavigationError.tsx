interface NavigationErrorProps {
  label: string
}

export function NavigationError({ label }: NavigationErrorProps) {
  return (
    <div className="text-sm text-destructive px-2">Failed to load {label}</div>
  )
}
