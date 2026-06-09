interface StatusBadgeProps {
  label: string
  variant?: 'active' | 'inactive' | 'pending'
  active?: boolean
}

export function StatusBadge({ label, variant, active }: StatusBadgeProps) {
  const resolved = variant ?? (active ? 'active' : 'inactive')
  const styles: Record<string, string> = {
    active: 'bg-[hsl(var(--status-active-bg))] text-[hsl(var(--status-active-fg))]',
    inactive: 'bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))]',
    pending: 'bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending-fg))]',
  }
  return (
    <span data-testid={`badge-${label}`}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[resolved] ?? styles.inactive}`}>
      {label}
    </span>
  )
}
